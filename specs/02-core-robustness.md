# Spec 02 — Core Rewrite: Robustness, Performance, Correctness

## Problem

The v2 pipeline is `FileReader.readAsDataURL → base64 string → new Image() → canvas`. It wastes memory (base64 = +33%), is slow for large files, lies about output format, has no safety limits, and its logic is untestable because everything lives in one closure.

## Architecture

Split into small pure/impure modules so pure logic is unit-testable without a browser:

```
src/
  index.ts          # public exports only
  types.ts          # public types (spec 01)
  errors.ts         # typed error classes
  options.ts        # PURE: normalize/validate options, legacy-arg mapping
  geometry.ts       # PURE: dimension math (resolveSize)
  mime.ts           # PURE: format<->mime maps, sniffing helpers
  decode.ts         # impure: blob -> ImageBitmap/HTMLImageElement
  encode.ts         # impure: canvas -> blob, capability detection, targetSize loop
  fromBlob.ts       # thin orchestrator
  fromURL.ts
  blobToURL.ts
  urlToBlob.ts
```

Rule: `options.ts`, `geometry.ts`, `mime.ts` must not touch `document`, `window`, `fetch`, or any DOM type at runtime.

## Decode path (performance)

Replace FileReader/data-URL with, in order of preference:

1. **`createImageBitmap(blob)`** — no base64, off-main-thread decode in Chromium, and honors EXIF orientation by default (`imageOrientation: 'from-image'`). Feature-detect.
2. Fallback: `URL.createObjectURL(blob)` + `HTMLImageElement` with `decode()`, and **always** `URL.revokeObjectURL` in a `finally` (no leaks on error paths).

Call `bitmap.close()` after drawing. This alone fixes the EXIF-rotated-phone-photo problem without any EXIF parsing code.

## Encode path (correctness)

### Format capability detection

`canvas.toBlob(cb, type)` silently falls back to `image/png` when `type` is unsupported. v2 then relabeled the blob — producing corrupt-by-metadata output. Fix:

- Supported output formats: `png`, `jpeg`, `webp` only. Drop `bmp` and `gif` from `ImageFormat` (no browser encodes them; v2 was silently producing mislabeled PNGs).
- After `toBlob`, check `blob.type !== requestedMime` → throw `UnsupportedFormatError` (covers e.g. `webp` on old Safari) instead of relabeling.
- Never wrap the result in `new Blob([blob], { type })` — return the encoder's blob as-is (also saves a full copy).
- When `format` is omitted: use input `blob.type` if it is an encodable type, else default to `image/png` (e.g. input gif/bmp/avif converts to png) — documented behavior instead of accident.

### Dimensions

- `resolveSize(natural, opts)` in `geometry.ts` returns **integers** (`Math.round`, min 1×1). No fractional canvas sizes.
- Support `width`/`height`/`'auto'` (existing behavior) plus `maxWidthOrHeight` (spec 01).
- Use high-quality scaling: `ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'`. (Two lines, visible quality win vs default on large downscales. Multi-step downscaling is explicitly rejected — complexity not justified.)

### Background flattening

- `backgroundColor` fills the canvas before drawImage for **any** output format (v2 restricted it to png; jpeg output of a transparent png is the case that needs it most — transparent pixels go black otherwise). Note in docs: jpeg with no `backgroundColor` gets a white default? **No** — keep browser behavior (black), document it, let users opt in. Predictability over magic.

## Safety limits (security)

- `MAX_PIXELS = 268_435_456` (16 384 × 16 384, aligned with common canvas caps). If `naturalWidth * naturalHeight > MAX_PIXELS` or target dims exceed it → throw `ImageTooLargeError` before allocating a canvas. Prevents decompression-bomb tab crashes with one comparison.
- No input byte-size cap anywhere (remove `blobToURL` 10 MB cap) — pixel count is the real resource, bytes are not.
- SSR guard: at entry of `fromBlob`/`fromURL`, if `typeof document === 'undefined' && typeof createImageBitmap === 'undefined'` → throw `EnvironmentError('image-resize-compress requires a browser environment')`. One clear error instead of a cryptic stack.

## Typed errors

```ts
// errors.ts — all extend Error, all carry .name for non-instanceof checks
export class ImageProcessError extends Error {} // base
export class InvalidImageError extends ImageProcessError {} // empty/corrupt/undecodable
export class UnsupportedFormatError extends ImageProcessError {}
export class ImageTooLargeError extends ImageProcessError {}
export class FetchError extends ImageProcessError {
  status?: number;
}
export class EnvironmentError extends ImageProcessError {}
```

- Exported publicly so users can `catch (e) { if (e instanceof UnsupportedFormatError) ... }`.
- Always chain the original: `new InvalidImageError('...', { cause: err })`. Never string-concat errors (v2 `Error: ${error}` loses stacks).
- Keep `TypeError`/`RangeError` for programmer errors (bad arguments), custom classes for runtime/data errors. `AbortError` (DOMException) passes through untouched.

## fromURL fixes

- Accurate errors: HTTP failure → `FetchError` with `status`; network/CORS failure (fetch rejects) → `FetchError` with `cause`, message mentions CORS only in the network case.
- Validate `response.blob().type` is image-ish (`image/*` or sniffable) before decode; a 200 HTML error page should produce `InvalidImageError('URL did not return an image (got text/html)')`, not a cryptic decode failure.
- Pass through **all** resize options (v2 dropped `backgroundColor`).
- `signal` in options aborts both fetch and processing.

## Non-goals

- No multi-step downscaling, no pica-style resampling, no EXIF read/write library. Each rejected as size/complexity vs benefit.
- Worker offload is spec 08, not here — BUT this spec must structure the pipeline for it: extract `processBitmap(bitmap, opts)` into `pipeline.ts` using a `makeCanvas(w, h)` abstraction (`OffscreenCanvas` when available, else `document.createElement('canvas')`; `convertToBlob` vs `toBlob` behind one function). No direct `document.createElement('canvas')` calls outside that abstraction.

## Acceptance criteria

- [ ] No `FileReader` usage remains in the resize path; object URLs are revoked on all paths (assert via test spy).
- [ ] A phone-photo fixture with EXIF orientation 6 comes out upright (browser test, Chromium).
- [ ] `format: 'bmp' as any` throws `UnsupportedFormatError`; no relabeled blobs anywhere (assert magic bytes match `blob.type` in tests).
- [ ] Output blob for jpeg conversion of transparent png: black background by default, red with `backgroundColor: '#f00'` (pixel-probe test).
- [ ] 1×1 through odd aspect ratios resize to exact integer dims; `resolveSize` has exhaustive unit tests (auto/auto, w/auto, auto/h, w/h, maxWidthOrHeight, rounding, min 1).
- [ ] Oversized synthetic image (mock naturalWidth) throws `ImageTooLargeError` without canvas allocation.
- [ ] Import + call in plain Node throws `EnvironmentError` with the exact message above.
- [ ] `fromURL` of a 404 rejects with `FetchError { status: 404 }` and message NOT mentioning CORS; all errors preserve `cause`.
- [ ] Pure modules (`options`, `geometry`, `mime`) import cleanly in Node with no DOM.
- [ ] Bundle ≤ 2 kB min+gzip.
