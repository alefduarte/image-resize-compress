# Spec 01 — API Redesign (Usability)

## Problem

The v2 API takes up to 6 positional parameters (`fromBlob(blob, quality, width, height, format, backgroundColor)`). It is error-prone (callers must remember order, pass `'auto'` placeholders to reach later params), cannot grow, and the `quality` scale is ambiguous (`1` means 1%, `0.5` means 50%, `50` means 50%).

## Design

### New primary signatures (options object)

```ts
// src/types.ts

export type ImageFormat = 'png' | 'jpeg' | 'webp'; // bmp/gif REMOVED — see spec 02

export interface ResizeOptions {
  /** 0–100. Only applies to jpeg/webp. Default: keep encoder default (undefined). */
  quality?: number;
  /** Target width in px, or 'auto' (default) to derive from height/original. */
  width?: number | 'auto';
  /** Target height in px, or 'auto' (default) to derive from width/original. */
  height?: number | 'auto';
  /** Cap the longest edge; aspect ratio preserved. Mutually exclusive with width/height. */
  maxWidthOrHeight?: number;
  /** Output format. Default: input format (falls back to png if input not encodable). */
  format?: ImageFormat;
  /** Flatten transparency onto this CSS color (any output format). */
  backgroundColor?: string;
  /**
   * Target output size in bytes. When set, quality is binary-searched (jpeg/webp)
   * to get ≤ targetSize. `quality` becomes the upper bound if also set.
   * Best-effort: resolves with the smallest achievable blob if target is unreachable.
   */
  targetSize?: number;
  /** Abort decode/encode/iteration. Rejects with DOMException 'AbortError'. */
  signal?: AbortSignal;
  /** Process off the main thread (OffscreenCanvas worker); silent fallback. See spec 08. */
  worker?: boolean;
}

export interface FromURLOptions extends ResizeOptions {
  /** Passed to fetch() (headers, credentials, signal is shared, etc.). */
  fetchOptions?: RequestInit;
}

export interface Size {
  width: number;
  height: number;
}
```

```ts
fromBlob(blob: Blob | File, options?: ResizeOptions): Promise<Blob>
fromURL(url: string, options?: FromURLOptions): Promise<Blob>
blobToURL(blob: Blob | File): Promise<string>          // return type fixed, cap removed
urlToBlob(url: string, fetchOptions?: RequestInit): Promise<Blob>
```

### Quality semantics (breaking, explicit)

- `quality` is **always 0–100** (integers or floats). No dual-scale guessing.
- `quality: 1` = 1%. `quality: 100` = maximum. Passed to `canvas.toBlob` as `quality / 100`.
- Validation: must be a finite number in `(0, 100]`, else `RangeError`. (Spec 02 defines error types.)
- Omitted `quality` → pass `undefined` to `toBlob` (browser encoder default), NOT 1.0. This matches user intent "just convert, don't recompress harder than needed".

### `targetSize` algorithm (the headline feature; keep it simple)

Binary search over quality, max 8 encode iterations:

```
lo = 1, hi = min(quality ?? 92, 100), best = null
repeat up to 8 times or until (hi - lo) <= 1:
  q = (lo + hi) / 2
  blob = encode(canvas, format, q)
  if blob.size <= targetSize: best = blob; lo = q   // try higher quality
  else: hi = q
return best ?? smallest blob seen
```

- Only valid for `jpeg`/`webp` output. With `png` output + `targetSize`, throw (`png` quality is not tunable via toBlob) — do not silently ignore.
- Check `signal.aborted` before each iteration.
- Document that it is best-effort; never loops forever.

### Backward compatibility (soft migration)

The v2 positional call must keep working through v3.x:

```ts
function fromBlob(blob, options?: ResizeOptions): Promise<Blob>;
/** @deprecated Use the options-object signature. Will be removed in v4. */
function fromBlob(blob, quality?: number, width?: number | 'auto',
                  height?: number | 'auto', format?: LegacyFormat | null,
                  backgroundColor?: string | null): Promise<Blob>;
```

- Detection: `typeof arg2 === 'number'` (or `arg3+` present) → legacy path; object or undefined → new path.
- Legacy path maps args into `ResizeOptions`, **preserving v2 quality semantics** (`q < 1` → fraction, else `/100`) so existing callers see zero behavior change.
- Legacy path emits `console.warn` once per session (module-level flag): `"[image-resize-compress] Positional arguments are deprecated; pass an options object. https://github.com/alefduarte/image-resize-compress#migrating-to-v3"`.
- Same overload treatment for `fromURL`.
- Legacy `format: 'bmp' | 'gif'` goes through the spec 02 capability check and now throws `UnsupportedFormatError` — this is the one intentional legacy break (previously it lied; see spec 02).

### Input validation summary (fail fast, clear messages)

| Input | Rule | Error |
|-------|------|-------|
| `blob` | `instanceof Blob`, `size > 0` | `TypeError` / `InvalidImageError` |
| `quality` | finite, `0 < q <= 100` | `RangeError` |
| `width`/`height` | `'auto'` or finite number `> 0` (integers after rounding) | `RangeError` |
| `maxWidthOrHeight` | finite `> 0`; not combined with explicit width/height | `RangeError` |
| `format` | member of `ImageFormat` | `UnsupportedFormatError` |
| `targetSize` | finite `> 0`; format must be jpeg/webp | `RangeError` |
| `url` | non-empty string | `TypeError` |

## Non-goals

- Web worker execution is NOT part of this spec — the `worker` option's behavior is fully specified in spec 08; here it only reserves the field (validation: boolean or undefined).
- No `onProgress` callback (adds surface for marginal value at our speed; revisit if requested).
- No EXIF metadata *preservation* (orientation handling is spec 02; keeping full EXIF in output is out of scope — canvas strips it, and that is a documented privacy *feature*).

## Acceptance criteria

- [ ] `fromBlob(file, { quality: 80, format: 'webp' })` works; `fromBlob(file, 80, 'auto', 'auto', 'webp')` still works and warns once.
- [ ] `quality: 1` produces visibly low-quality jpeg (≈1%), verified in browser test.
- [ ] `targetSize` produces a blob ≤ target for a compressible photo fixture, in ≤ 8 encodes.
- [ ] `signal` abort during processing rejects with `AbortError`.
- [ ] `maxWidthOrHeight: 100` on a 200×400 image yields 50×100.
- [ ] All validation rows above have a unit test each.
- [ ] `blobToURL` returns `Promise<string>`, no size cap.
- [ ] TypeScript consumers get deprecation strikethrough on positional overloads.
- [ ] README migration section drafted (hand off to spec 07).
- [ ] Bundle stays ≤ 2 kB min+gzip (pre-worker budget; spec 08 raises to 3 kB).
