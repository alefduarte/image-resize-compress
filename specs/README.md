# image-resize-compress — v3 Improvement Specs

Master index for the v3.0.0 overhaul. Each spec is self-contained and implementable by an independent agent, but the order below matters.

## Goal

Make `image-resize-compress` more robust, secure, testable, smaller, faster, and easier to use and maintain than `browser-image-compression` — while staying a simple, zero-dependency browser library. No overengineering: every addition must earn its place.

## Current state audit (2026-07, v2.1.1)

Verified problems in the existing code:

| #   | Problem                                                                                                                                                                                                                                  | Where                     | Severity |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------- |
| 1   | `quality` scale ambiguity: `quality < 1 ? quality : quality / 100` means `fromBlob(blob, 1)` = 1% quality, `0.5` = 50%, `50` = 50%                                                                                                       | `fromBlob.ts`             | High     |
| 2   | Format lie: `canvas.toBlob` silently falls back to PNG for unsupported formats (`bmp`, `gif` are not encodable in any major browser), then code re-wraps with the _requested_ mime type — blob claims `image/bmp` but contains PNG bytes | `fromBlob.ts`             | High     |
| 3   | README VanillaJS example is broken: no IIFE/UMD build exists, `dist/index.js` is ESM, global `imageResizeCompress` never defined                                                                                                         | `tsup.config.ts` / README | High     |
| 4   | `exports` map has no `types` condition; CJS consumers resolve ESM-flavored `.d.ts`; `./types` subpath is nonstandard                                                                                                                     | `package.json`            | High     |
| 5   | Tests mock everything (canvas, Image, toBlob returns literal text `'mocked blob'`) — they verify mocks, not behavior                                                                                                                     | `src/__tests__/`          | High     |
| 6   | Decode path uses `FileReader.readAsDataURL` → base64 string → `Image` — ~33% memory overhead and slow for large files; `createImageBitmap` / object URLs are strictly better                                                             | `fromBlob.ts`             | Medium   |
| 7   | Undocumented hard 10 MB cap in `blobToURL` rejects valid use                                                                                                                                                                             | `blobToURL.ts`            | Medium   |
| 8   | No guard against decompression bombs (huge pixel dimensions → canvas OOM / tab crash)                                                                                                                                                    | `fromBlob.ts`             | Medium   |
| 9   | `fromURL` drops the `backgroundColor` parameter, double-wraps errors (loses stack), and always blames CORS even on HTTP 404                                                                                                              | `fromURL.ts`              | Medium   |
| 10  | `getHeightWidth` returns fractional dimensions (rounded to 2 decimals); canvas truncates them silently                                                                                                                                   | `fromBlob.ts`             | Low      |
| 11  | `blobToURL` return type `string \| ArrayBuffer` is wrong — `readAsDataURL` always yields `string`                                                                                                                                        | `blobToURL.ts`            | Low      |
| 12  | `quality > 100` and non-finite values unvalidated                                                                                                                                                                                        | `fromBlob.ts`             | Low      |
| 13  | No `AbortSignal` support for decode/encode; no cancellation story                                                                                                                                                                        | all                       | Low      |
| 14  | Importing in SSR/Node then calling throws cryptic `document is not defined`                                                                                                                                                              | all                       | Low      |
| 15  | No CI workflows at all (only dependabot). Publishing is manual, unsigned, no provenance                                                                                                                                                  | `.github/`                | High     |
| 16  | Positional-args API (6 positional params) is error-prone and can never grow                                                                                                                                                              | public API                | High     |

## Spec index and implementation order

| Order | Spec                                                       | Depends on   | Summary                                                                                                   |
| ----- | ---------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| 1     | [01-api-redesign.md](01-api-redesign.md)                   | —            | Options-object API, new capabilities (`targetSize`, `maxWidthOrHeight`, `signal`), migration/compat layer |
| 2     | [02-core-robustness.md](02-core-robustness.md)             | 01           | Internal rewrite: modern decode path, format capability detection, typed errors, safety limits            |
| 3     | [03-testing.md](03-testing.md)                             | 02           | Vitest with real-browser tests, pure-function unit tests, fixtures, coverage gates                        |
| 4     | [04-build-packaging.md](04-build-packaging.md)             | 02           | Correct exports map, IIFE build, size budget, publint/attw checks                                         |
| 5     | [05-ci-cd-release.md](05-ci-cd-release.md)                 | 03, 04       | GitHub Actions CI, semantic-release, commitlint, PR title enforcement                                     |
| 6     | [06-security-supply-chain.md](06-security-supply-chain.md) | 05           | npm provenance + trusted publishing (the "signing" answer), 2FA, SECURITY.md, hardening                   |
| 7     | [07-community-maintenance.md](07-community-maintenance.md) | — (parallel) | PR/issue templates, CONTRIBUTING, CODEOWNERS, README overhaul                                             |
| 8     | [08-web-worker.md](08-web-worker.md)                       | 02, 03       | Opt-in `worker: true` — OffscreenCanvas pipeline off main thread, silent fallback                         |

## Hard constraints (apply to every spec)

- **Zero runtime dependencies.** Non-negotiable.
- **Bundle budget:** ESM build ≤ 3.0 kB min+gzip (≤ 2.0 kB before spec 08's worker lands). Enforced in CI via `size-limit`.
- **Browser-only scope.** No Node canvas support. Fail fast with a clear error outside the browser.
- **Web workers: opt-in only** (`worker: true`, spec 08). Default path stays main-thread; worker failure falls back silently. Our pitch stays smaller + simpler + provenance-signed.
- **TypeScript strict**, ESM-first, CJS + IIFE builds for compat.
- **v3.0.0 is a breaking release**, but the v2 positional signature must keep working with a console deprecation warning (see spec 01) so migration is soft.

## Versioning plan

- All of this ships as `3.0.0` via semantic-release once specs 1–6 land on `master`. Spec 08 may ship in 3.0.0 if ready, else as `3.1.0` (`feat:`) — it is purely additive.
- Breaking changes: quality scale normalization, `bmp`/`gif` output removal (throw instead of lie), `blobToURL` cap removal, error types.

## Competitive positioning vs browser-image-compression

| Dimension                  | browser-image-compression | image-resize-compress v3 target                      |
| -------------------------- | ------------------------- | ---------------------------------------------------- |
| Size (min+gzip)            | ~9 kB                     | ≤ 3 kB                                               |
| Dependencies               | 1 (uzip fork inlined)     | 0                                                    |
| Target file size           | `maxSizeMB` iterative     | `targetSize` binary-search (spec 01)                 |
| Web worker                 | yes (default-ish)         | yes — opt-in, zero-config, silent fallback (spec 08) |
| AbortSignal                | yes                       | yes (spec 01)                                        |
| EXIF orientation           | manual transforms         | `createImageBitmap` native handling (spec 02)        |
| URL input                  | no                        | yes (`fromURL`)                                      |
| Format conversion          | limited                   | png/jpeg/webp with capability detection              |
| Provenance-signed releases | no                        | yes (spec 06)                                        |
| Real-browser test suite    | partial                   | yes (spec 03)                                        |

## Instructions for implementing agents

- Read this file plus your assigned spec fully before coding.
- Each spec ends with **Acceptance criteria** — all must pass before the task is done.
- Follow Conventional Commits (`feat:`, `fix:`, `test:`, `ci:`, `chore:`, with `!` / `BREAKING CHANGE:` footers where the spec says so).
- Do not add runtime dependencies. Do not exceed the size budget. When in doubt, cut the feature, not the budget.
- Existing public function names (`fromBlob`, `fromURL`, `blobToURL`, `urlToBlob`) must remain exported.
