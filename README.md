# image-resize-compress

[![npm version](https://img.shields.io/npm/v/image-resize-compress.svg)](https://www.npmjs.com/package/image-resize-compress)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/image-resize-compress)](https://bundlephobia.com/package/image-resize-compress)
[![CI](https://github.com/alefduarte/image-resize-compress/actions/workflows/ci.yml/badge.svg)](https://github.com/alefduarte/image-resize-compress/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/image-resize-compress)](./LICENSE)

Resize, compress, and convert images in the browser — from a `File`, `Blob`, or
URL — in **~3 kB** with **zero runtime dependencies**.

Releases are published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
(the green **Provenance** badge on [npmjs.com](https://www.npmjs.com/package/image-resize-compress)),
so you get cryptographic proof each tarball was built from this repository.

> ✨ [Demo](https://alefduarte.github.io/image-resize-compress-demo/) — note: the
> hosted demo still targets the **v2** API and has not been updated for v3 yet.

## Why this over browser-image-compression?

| Dimension                  | image-resize-compress                   | browser-image-compression |
| -------------------------- | --------------------------------------- | ------------------------- |
| Size (min+gzip)            | **~3 kB**                               | ~9 kB                     |
| Runtime dependencies       | **0**                                   | 1 (inlined uzip fork)     |
| Target file size           | `targetSize` (binary search)            | `maxSizeMB` (iterative)   |
| URL input                  | ✅ `fromURL`                            | ❌                        |
| Web worker                 | ✅ opt-in, zero-config, silent fallback | ✅ (default-ish)          |
| `AbortSignal`              | ✅                                      | ✅                        |
| EXIF orientation           | ✅ native (`createImageBitmap`)         | ✅ manual transforms      |
| Provenance-signed releases | ✅                                      | ❌                        |
| Real-browser test suite    | ✅ (Playwright/Chromium)                | partial                   |
| Progress callback          | ❌                                      | ✅ `onProgress`           |

If you need per-image progress reporting, `browser-image-compression` has it and
we don't. For nearly everything else, this library is smaller and simpler.

## Installation

```sh
npm install image-resize-compress
# or: pnpm add image-resize-compress / yarn add image-resize-compress
```

```js
import { fromBlob, fromURL, blobToURL, urlToBlob } from 'image-resize-compress';
```

## Quickstart

All processing functions take an **options object**. Every field is optional.

```js
import { fromBlob } from 'image-resize-compress';

// Convert to WebP at 80% quality, cap the longest edge at 1920px:
const out = await fromBlob(file, {
  quality: 80,
  maxWidthOrHeight: 1920,
  format: 'webp',
});
```

### Headline feature: hit a target file size

Pass `targetSize` (in **bytes**) and the library binary-searches quality
(jpeg/webp only, ≤ 8 encodes) to produce a blob at or under that size:

```js
// Aim for ≤ 200 kB, keep dimensions:
const compressed = await fromBlob(file, {
  format: 'jpeg',
  targetSize: 200 * 1024,
});
```

It is best-effort: if the target is unreachable it resolves with the smallest
blob it managed to produce. It never loops forever.

### Off the main thread

Set `worker: true` to run decode→resize→encode in a Web Worker (via
`OffscreenCanvas`), keeping the UI responsive:

```js
const out = await fromBlob(bigFile, {
  format: 'webp',
  worker: true,
  quality: 75,
});
```

- **Opt-in and silent-fallback.** If the environment lacks `OffscreenCanvas`, or
  a strict CSP blocks blob workers, it transparently runs on the main thread —
  same result, same errors. `worker: true` never rejects where `worker: false`
  would succeed.
- **CSP:** a strict Content-Security-Policy needs `worker-src blob:` (or
  `child-src blob:`). Without it the library silently uses the main thread.
- **Worth it for** images larger than ~5 MB and multi-file batches; pointless
  for thumbnails.
- **Abort behavior:** aborting rejects the caller immediately with `AbortError`.
  An already in-flight worker job (e.g. a long `targetSize` search) still
  finishes internally before the next queued worker call starts — its late
  result is simply discarded.

## API

### `fromBlob(blob, options?) → Promise<Blob>`

Resize, compress, and/or convert a `Blob` or `File`.

| Option             | Type                        | Default            | Notes                                                               |
| ------------------ | --------------------------- | ------------------ | ------------------------------------------------------------------- |
| `quality`          | `number` (0–100]            | encoder default    | jpeg/webp only. Omit to avoid recompressing harder than needed.     |
| `width`            | `number \| 'auto'`          | `'auto'`           | Derived from `height`/original when `'auto'`.                       |
| `height`           | `number \| 'auto'`          | `'auto'`           | Derived from `width`/original when `'auto'`.                        |
| `maxWidthOrHeight` | `number`                    | —                  | Caps the longest edge, preserves aspect. Excludes `width`/`height`. |
| `format`           | `'png' \| 'jpeg' \| 'webp'` | input format → png | Output format.                                                      |
| `backgroundColor`  | `string` (CSS color)        | transparent        | Flattens transparency onto this color.                              |
| `targetSize`       | `number` (bytes)            | —                  | jpeg/webp only; binary-searches quality.                            |
| `signal`           | `AbortSignal`               | —                  | Rejects with `AbortError`.                                          |
| `worker`           | `boolean`                   | `false`            | Off-main-thread, silent fallback (see above).                       |

**Throws:** `TypeError` (not a `Blob`), `InvalidImageError` (empty/undecodable),
`RangeError` (bad `quality`/dimensions/`targetSize`, or `targetSize` with `png`),
`UnsupportedFormatError` (bad `format`), `ImageTooLargeError` (pixel-count guard),
`EnvironmentError` (not a browser), or `AbortError` (aborted).

### `fromURL(url, options?) → Promise<Blob>`

Fetch an image from a URL, then process it. Accepts every `ResizeOptions` field
plus `fetchOptions?: RequestInit` (headers, credentials, etc.). The server must
allow [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).

```js
const blob = await fromURL('https://example.com/photo.jpg', {
  format: 'webp',
  maxWidthOrHeight: 1024,
  fetchOptions: { headers: { Authorization: 'Bearer …' } },
});
```

**Throws:** everything `fromBlob` throws, plus `FetchError` (network/CORS or a
non-2xx response — carries `.status` for HTTP errors) and `InvalidImageError`
when the URL returns a non-image response.

### `blobToURL(blob) → Promise<string>`

Read a `Blob`/`File` into a data-URL `string` (handy for `<img src>` previews).
No size cap.

```js
const dataUrl = await blobToURL(resizedBlob);
```

### `urlToBlob(url, fetchOptions?) → Promise<Blob>`

Fetch a URL and return the raw `Blob` (no processing).

```js
const blob = await urlToBlob('https://example.com/photo.jpg');
```

### Error classes

Typed errors are exported so you can branch with `instanceof`. All extend
`ImageProcessError`. Abort rejects with a standard `DOMException` named
`AbortError`; argument mistakes throw built-in `TypeError`/`RangeError`.

```js
import {
  fromURL,
  ImageProcessError,
  InvalidImageError,
  UnsupportedFormatError,
  ImageTooLargeError,
  FetchError,
  EnvironmentError,
} from 'image-resize-compress';

try {
  await fromURL(url, { format: 'webp' });
} catch (err) {
  if (err instanceof FetchError) {
    console.error('fetch failed', err.status); // status set for HTTP errors
  } else if (err instanceof InvalidImageError) {
    console.error('not a usable image');
  } else if (err instanceof ImageProcessError) {
    console.error('processing failed', err.name);
  } else if (err.name === 'AbortError') {
    // cancelled — ignore
  }
}
```

## Recipes

### File input → preview

```jsx
async function onChange(e) {
  const file = e.target.files[0];
  const resized = await fromBlob(file, {
    maxWidthOrHeight: 512,
    format: 'webp',
  });
  img.src = await blobToURL(resized);
}
```

### Enforce a max upload size

```js
const under1MB = await fromBlob(file, {
  format: 'jpeg',
  targetSize: 1024 * 1024,
});
```

### Abort on component unmount (React)

```jsx
useEffect(() => {
  const controller = new AbortController();
  fromBlob(file, { format: 'webp', signal: controller.signal })
    .then(setResult)
    .catch((err) => {
      if (err.name !== 'AbortError') throw err;
    });
  return () => controller.abort();
}, [file]);
```

### HEIC input?

**Not supported.** Browsers cannot decode HEIC/HEIF via `createImageBitmap` or
`<img>`, so there is nothing to resize. Detect it and tell the user to convert
first (most phones can export JPEG):

```js
const isHeic = /\.(heic|heif)$/i.test(file.name) || /hei[cf]/.test(file.type);
if (isHeic) {
  // Ask the user for a JPEG/PNG, or run a dedicated HEIC decoder before this.
}
```

### SSR (Next.js, etc.)

This library runs **only in the browser**. Called during server rendering it
throws `EnvironmentError` (instead of a cryptic `document is not defined`). Call
it client-side — inside an effect, an event handler, or a `'use client'`
component.

## Migrating to v3

v3 replaces the positional arguments with an options object. The **old
positional signature still works** but logs a one-time deprecation warning
(`image-resize-compress: Positional arguments are deprecated; pass an options object.`)
and will be removed in v4.

| v2 (positional)                                     | v3 (options object)                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `fromBlob(file, 80, 'auto', 'auto', 'webp')`        | `fromBlob(file, { quality: 80, format: 'webp' })`                         |
| `fromBlob(file, 80, 200, 'auto', 'jpeg')`           | `fromBlob(file, { quality: 80, width: 200, format: 'jpeg' })`             |
| `fromURL(url, 75, 200, 'auto', 'webp')`             | `fromURL(url, { quality: 75, width: 200, format: 'webp' })`               |
| `fromBlob(file, 90, 'auto', 'auto', 'png', '#fff')` | `fromBlob(file, { quality: 90, format: 'png', backgroundColor: '#fff' })` |

**Breaking: `quality` is now always 0–100.** In v2, values below `1` were
treated as a 0–1 fraction (`0.8` meant 80%). In v3's options API there is no
dual scale — `quality` is passed straight through as `quality / 100`, so **`0.8`
now means 0.8%, not 80%**. A v2 caller who wrote `0.8` for 80% must write `80`.
(Values ≥ 1 are unchanged: `50` = 50%, `1` = 1%.) The deprecated **positional**
path preserves the old dual-scale semantics, so the change only bites when you
switch to the options object — do the conversion at the same time.

**Breaking: `bmp` and `gif` output removed.** No major browser can _encode_
these via `canvas.toBlob`; v2 silently produced PNG bytes mislabeled with the
requested mime type. v3 throws `UnsupportedFormatError` instead of lying. Use
`png`, `jpeg`, or `webp`.

**Other changes:** `blobToURL` no longer has a 10 MB cap and always resolves to
a `string`; decode/encode errors are now typed classes; EXIF orientation is
applied automatically; canvas re-encoding strips EXIF/GPS metadata (a privacy
feature).

## CDN (VanillaJS)

The IIFE build exposes a global `imageResizeCompress`:

```html
<script src="https://cdn.jsdelivr.net/npm/image-resize-compress/dist/index.global.js"></script>
<script>
  async function resize() {
    const file = document.querySelector('#fileInput').files[0];
    const blob = await imageResizeCompress.fromBlob(file, {
      quality: 75,
      format: 'webp',
    });
    console.log(blob);
  }
</script>
<input type="file" id="fileInput" onchange="resize()" />
```

Works on unpkg too (`https://unpkg.com/image-resize-compress/dist/index.global.js`).

## Compatibility

Browser-only; no IE. Works on all evergreen browsers.

| Capability         | Requirement                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- |
| Core decode/encode | `createImageBitmap` — or falls back to `HTMLImageElement` decode                      |
| `worker: true`     | `OffscreenCanvas` (Chrome, Firefox, Safari ≥ 16.4) — else silent main-thread fallback |
| Everything         | Must run in a browser; server-side use throws `EnvironmentError`                      |

## License

[MIT](./LICENSE) © Alef Duarte

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md).
