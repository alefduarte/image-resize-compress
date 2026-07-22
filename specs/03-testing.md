# Spec 03 — Testing Strategy

## Problem

Current tests run in jsdom with everything mocked: `getContext` returns a bag of `jest.fn()`, `toBlob` returns `new Blob(['mocked blob'])`. They verify that mocks were called, not that images are resized, compressed, or converted. The library's core value is completely untested. Jest + ts-jest is also slow and fights ESM.

## Decision

**Vitest**, two tiers:

1. **Unit tier** (Node, no DOM): pure modules from spec 02 — `options.ts`, `geometry.ts`, `mime.ts`, `errors.ts`. Fast, exhaustive, runs everywhere.
2. **Browser tier** (Vitest Browser Mode + Playwright provider, Chromium in CI): the real pipeline against real image fixtures. Real canvas, real `toBlob`, real `createImageBitmap`. This is the tier that actually proves the library works.

Remove Jest, ts-jest, jest-environment-jsdom, @types/jest, @jest/globals entirely. No jsdom anywhere — jsdom canvas can only produce mock-driven lies for this library.

## Layout

```
vitest.config.ts          # workspace: unit (node) + browser (chromium) projects
src/**/*.unit.test.ts     # tier 1, colocated with modules
tests/browser/*.test.ts   # tier 2
tests/fixtures/           # tiny real images, committed (each < 30 kB)
  photo-800x600.jpg       # compressible photo (for targetSize + quality tests)
  transparent-64x64.png   # alpha channel (backgroundColor tests)
  exif-orientation-6.jpg  # rotated phone photo (EXIF test)
  tiny-1x1.png
  animated.gif            # decode-only input (converts to png)
  not-an-image.txt
tests/helpers.ts          # loadFixture(), decodeDims(blob), magicBytes(blob)
```

Fixtures are loaded via `fetch('/fixtures/...')` served by Vitest browser mode (configure `server.fs` / public dir), not base64 blobs in source.

## What the browser tier must prove

| Test                   | Assertion                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Resize exact           | `fromBlob(photo, { width: 200 })` → decode result, dims are 200×150                                               |
| Aspect auto            | height-only, maxWidthOrHeight variants → exact expected integer dims                                              |
| Compression works      | `quality: 30` jpeg output is ≥ 40% smaller than `quality: 95` output of same fixture                              |
| Format conversion real | `format: 'webp'` → magic bytes `RIFF....WEBP`, `blob.type === 'image/webp'` (bytes checked, not just the label)   |
| gif input → png out    | animated.gif with no format → png magic bytes                                                                     |
| targetSize             | photo with `targetSize: 20_000` → `size <= 20_000`, and result still decodable                                    |
| targetSize unreachable | absurdly small target → resolves with smallest attempt (no infinite loop, < 9 encodes via spy)                    |
| EXIF orientation       | orientation-6 fixture → output width/height swapped vs raw naturalWidth (upright)                                 |
| backgroundColor        | transparent png → jpeg with `backgroundColor: '#ff0000'` → probe pixel is red                                     |
| Abort                  | pre-aborted signal rejects `AbortError`; no blob produced                                                         |
| Errors                 | not-an-image.txt → `InvalidImageError`; empty blob → `InvalidImageError`; `bmp` format → `UnsupportedFormatError` |
| fromURL                | served fixture URL end-to-end; 404 → `FetchError{status:404}`; HTML response → `InvalidImageError`                |
| Legacy overload        | `fromBlob(photo, 80, 100, 'auto', 'webp')` still works + warns once (spy on console.warn)                         |
| blobToURL/urlToBlob    | round-trip: blob → dataURL → still starts `data:image/`; urlToBlob returns image blob                             |
| No leaks               | spy `URL.createObjectURL`/`revokeObjectURL` — every create has a matching revoke, including on error paths        |

`decodeDims(blob)` helper: `createImageBitmap(blob)` → `{width, height}`. `magicBytes(blob)`: first 12 bytes hex.

## What the unit tier must prove

- `resolveSize`: full matrix (auto/auto, w/auto, auto/h, w/h, maxWidthOrHeight up/down/no-op, rounding to int, floor at 1×1, MAX_PIXELS interplay).
- `normalizeOptions`: every validation row from spec 01 table → exact error class + message; legacy-args mapping incl. v2 quality semantics (`0.5`→50, `1`→1 legacy vs new).
- `mime`: format↔mime maps, image-type sniffing helper.
- Error classes: instanceof chains, `name`, `cause` propagation.

## Coverage & config

- `vitest --coverage` (v8 provider). Thresholds: **90% lines/branches on `src/`** (pure modules should be ~100%; orchestrators covered by browser tier).
- Scripts: `"test": "vitest run"`, `"test:unit"`, `"test:browser"`, `"test:watch"`, `"coverage"`.
- CI (spec 05) runs both tiers; Playwright Chromium installed via `npx playwright install chromium --with-deps`. Firefox/WebKit: not in CI matrix for v3 (keep CI fast); revisit if browser-specific bugs appear.

## Non-goals

- No visual-regression/screenshot testing, no fuzzing, no Node-canvas polyfill tier.

## Acceptance criteria

- [ ] Jest fully removed; `pnpm test` runs unit + browser tiers green locally and in CI.
- [ ] Every row of both tables above exists as a test.
- [ ] Coverage ≥ 90% lines and branches; threshold enforced in config (build fails below).
- [ ] All fixtures committed, each < 30 kB, total < 100 kB.
- [ ] A contributor can run `pnpm test:unit` with zero browser setup (fast inner loop).
