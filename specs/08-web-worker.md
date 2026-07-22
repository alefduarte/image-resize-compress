# Spec 08 — Opt-in Web Worker Support

## Goal

`fromBlob(file, { worker: true })` runs the whole decode→resize→encode pipeline off the main thread. Opt-in, default `false`. Zero cost (code path and mental model) for users who don't enable it. This closes the one real feature gap vs `browser-image-compression` while staying far smaller.

## API

```ts
export interface ResizeOptions {
  // ...spec 01 fields...
  /**
   * Process off the main thread using a Web Worker + OffscreenCanvas.
   * Falls back silently to main-thread processing when the environment
   * lacks support (no OffscreenCanvas, CSP blocks blob workers, etc.).
   * Default: false.
   */
  worker?: boolean;
}
```

- **Progressive enhancement, silent fallback.** `worker: true` is a hint, not a demand. If worker setup or feature detection fails, run the existing main-thread path — same result, same errors. Rationale: callers can't do anything useful with a "worker unavailable" error except retry without it; the library should do that for them. No API to detect which path ran (YAGNI; revisit if requested).
- Applies to `fromBlob` and `fromURL` (fetch stays on main thread — it's already async/non-blocking; only decode/encode move to the worker).
- Ignored (main-thread path) when `format`/pipeline requires anything OffscreenCanvas can't do — currently nothing; listed for future-proofing.

## Implementation

### Inline worker, no separate file

Worker source is a function stringified at build time into a Blob URL — keeps the package a single self-contained bundle, works with every bundler, no asset-path configuration for users (this is where most worker libs create friction):

```ts
// worker/host.ts (main thread side)
let workerPromise: Promise<Worker> | null = null;   // lazy singleton

function getWorker(): Promise<Worker> {
  // create Blob(['(', workerMain.toString(), ')()'], {type:'text/javascript'})
  // URL.createObjectURL → new Worker(url). Revoke URL after construction.
  // Any throw here (CSP worker-src, no Worker global) → caller falls back.
}
```

Constraints on `worker/main.ts` (the code that gets stringified):

- Must be **fully self-contained after bundling** — it can share pure helpers (`geometry.ts`, `mime.ts`, encode loop) via normal imports ONLY if tsup inlines them into the stringified function scope. That is fragile; instead: **extract the shared pipeline into `pipeline.ts`** — a single pure-ish function `processBitmap(bitmap, opts) → Promise<Blob>` that uses only globals available in BOTH window and worker (`OffscreenCanvas` in worker, injected canvas factory on main thread). Worker entry = thin `onmessage` wrapper around `createImageBitmap` + `processBitmap`. Canvas creation is abstracted: `makeCanvas(w, h)` returns `OffscreenCanvas` when available else `document.createElement('canvas')` — this ALSO simplifies the main-thread path (spec 02's encode.ts uses the same abstraction; `OffscreenCanvas.convertToBlob` vs `canvas.toBlob` behind one function).
- No closure over module state, no imports of DOM-typed modules.

### Feature detection (main thread, once, cached)

```
supportsWorkerPath =
  typeof Worker === 'function' &&
  typeof OffscreenCanvas === 'function' &&
  typeof createImageBitmap === 'function' &&
  worker construction succeeded (CSP check happens at first real use)
```

Safari ≥ 16.4, Chrome, Firefox all pass. Older → silent fallback.

### Protocol

```ts
// request:  { id: number, blob: Blob, opts: SerializableOptions }
// response: { id, ok: true, blob: Blob }
//         | { id, ok: false, error: { name: string, message: string } }
// abort:    { id, type: 'abort' }
```

- `SerializableOptions` = ResizeOptions minus `signal` minus `worker` (both stripped; signal handled below). All remaining fields are structured-clone-safe primitives.
- Blobs pass by structured clone (cheap — Blob clone is by reference under the hood in all engines).
- `id` counter correlates concurrent calls on the singleton worker; pending map on host side.
- **Errors**: worker catches everything, posts `{name, message}`; host rehydrates the matching typed error class from spec 02's `errors.ts` (map by `name`, fallback `ImageProcessError`), so `instanceof` works identically on both paths. `cause` doesn't survive the boundary — acceptable, document it.
- **AbortSignal**: host listens to `signal`; on abort → post `{id, type:'abort'}` and immediately reject caller's promise with `AbortError`. Worker checks an aborted-ids set between targetSize iterations and before encode; late results for aborted ids are dropped by host. No worker termination on abort (worker is shared).
- Singleton worker never terminated by the library (negligible idle cost, avoids respawn latency for batch use). Concurrent calls queue naturally via message interleaving — OffscreenCanvas work is still serial per worker; **one worker only** in v3.x (N-worker pool = future, not now).

### What runs where (`worker: true`, supported env)

| Step | Where |
|------|-------|
| validation / option normalization | main thread (fail fast, sync) |
| fetch (`fromURL`) | main thread |
| `createImageBitmap(blob)` | worker |
| resize + encode (+ targetSize loop) | worker |
| error rehydration | main thread |

## Size budget impact

Worker host + entry + protocol ≈ 0.7–1.0 kB min+gzip. New limits (updates spec 04):

```jsonc
"size-limit": [
  { "path": "dist/index.js", "limit": "3 kB" },
  { "path": "dist/index.global.js", "limit": "3.5 kB" }
]
```

Still ~3× smaller than browser-image-compression. Same rule: budget is a ceiling, shrink code not raise limit.

## Tests (extends spec 03 browser tier)

| Test | Assertion |
|------|-----------|
| Parity | Same fixture + opts with `worker: true` vs `false` → same output dims, same `blob.type`, size within ±5% |
| Actually off-thread | With `worker: true`, `Worker` constructor spy called; message round-trip observed |
| Fallback | Stub `OffscreenCanvas = undefined` → `worker: true` still resolves correctly (main path) |
| CSP-style failure | Make `new Worker` throw → silent fallback, result correct, no unhandled rejection |
| Typed errors cross boundary | `bmp` format + `worker: true` → rejects `UnsupportedFormatError` (instanceof) |
| Abort | Abort mid-targetSize-loop with `worker: true` → `AbortError`; later completion for that id ignored |
| Concurrency | 4 simultaneous `worker: true` calls with different opts → 4 correct, non-swapped results (id correlation) |
| targetSize in worker | `targetSize` honored with `worker: true` |
| Reuse | Two sequential calls → exactly one `Worker` constructed |

## Docs (extends spec 07)

- README: `worker: true` in quickstart recipes ("keep UI responsive for large images / batches"); comparison table row becomes "Web worker: yes (opt-in, zero-config)".
- Note CSP requirement: strict CSP needs `worker-src blob:` (or `child-src`); without it the library silently uses the main thread — feature, not bug, but say it.
- Guidance: worth enabling for images > ~5 MB or multi-file batches; pointless for thumbnails.

## Acceptance criteria

- [ ] All tests in table above green in Chromium CI.
- [ ] `worker: true` never rejects in ANY environment where `worker: false` would resolve (fallback guarantee).
- [ ] No separate worker file in the npm tarball; bundle self-contained; works via CDN IIFE build too.
- [ ] Size limits: ESM ≤ 3 kB, IIFE ≤ 3.5 kB min+gzip.
- [ ] Main-thread-only users pay no runtime cost beyond one feature-detect branch (worker code may still be in bundle — acceptable at this size; do NOT add a subpath export split for this in v3).
- [ ] Long-lived page with 100 sequential worker calls: no growth in pending map, no leaked object URLs (worker blob URL revoked post-construction).
