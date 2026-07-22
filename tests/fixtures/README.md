# Test fixtures

Small, real image files used by the browser test tier (spec 03). They are
**committed** so tests never depend on a network or on regeneration. Each file
is < 30 kB and the whole directory is < 100 kB.

All raster fixtures are produced by `scripts/gen-fixtures.mjs`, a one-off
Playwright script that draws on a real `<canvas>` in headless Chromium, encodes
via `canvas.toBlob`, and **verifies every fixture decodes (and that the EXIF
orientation actually swaps dimensions) before writing** — a broken fixture fails
at generation, not mid-suite.

Regenerate with:

```sh
node scripts/gen-fixtures.mjs
```

| File                     | How it was made                                                                                                                                                                                                                                                                    | Purpose                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `photo-800x600.jpg`      | 800×600 canvas: diagonal gradient + ~400 translucent arcs + mild per-pixel noise, encoded `image/jpeg` q≈0.22 (kept < 30 kB while retaining enough high-frequency detail that a q95 re-encode is >2× a q30 re-encode).                                                             | resize, compression ratio, `targetSize`.                                               |
| `transparent-64x64.png`  | 64×64 canvas, cleared to full transparency, with an opaque green 32×32 top-left quadrant, encoded `image/png`.                                                                                                                                                                     | alpha channel → `backgroundColor` flattening tests (probe a transparent-region pixel). |
| `exif-orientation-6.jpg` | 90×60 (landscape) canvas with a red stripe along the top, encoded `image/jpeg`; then an EXIF APP1 segment carrying `Orientation = 6` (rotate 90° CW) is spliced in right after the SOI marker by `injectExifOrientation6()`. Decoders that honor EXIF present it upright as 60×90. | EXIF orientation handling (`createImageBitmap({ imageOrientation: 'from-image' })`).   |
| `tiny-1x1.png`           | 1×1 opaque-red canvas, encoded `image/png`.                                                                                                                                                                                                                                        | trivial smallest-valid-image input.                                                    |
| `animated.gif`           | The canonical 43-byte 1×1 transparent GIF89a (well-known battle-tested bytes; verified to decode in the generator). Used only as a decode-only "gif input → png output" case; the suite never inspects frame count.                                                                | GIF decode → PNG conversion.                                                           |
| `not-an-image.txt`       | Plain UTF-8 text written directly.                                                                                                                                                                                                                                                 | non-image input → `InvalidImageError`.                                                 |

## EXIF fixture details

The generator asserts the swap at creation time: it parses the encoded frame
dimensions from the JPEG's SOF marker (which ignores EXIF), decodes the blob
with `imageOrientation: 'from-image'`, and requires the decoded dimensions to be
the transpose of the encoded ones (encoded 90×60 → decoded 60×90). The browser
test then asserts the pipeline output is 60×90.
