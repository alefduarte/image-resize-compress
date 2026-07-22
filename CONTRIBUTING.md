# Contributing to image-resize-compress

Thanks for helping! This is a small, zero-dependency, browser-only library. The
guardrails below keep it that way.

## Setup

This repo uses **pnpm** (pinned via `packageManager`). Enable it with corepack:

```sh
corepack enable
pnpm install
```

### Test loops

Tests are split into two tiers:

- **Fast loop (no browser):** pure-logic unit tests run in Node.

  ```sh
  pnpm test:unit
  ```

  A fresh clone reaches green here with nothing beyond `pnpm install` — use it
  while iterating.

- **Browser tier (source of truth):** real Chromium via Playwright. Behavioral
  correctness (decode, canvas encode, worker, EXIF) is only truly verified here.

  ```sh
  npx playwright install chromium   # one time
  pnpm test:browser
  ```

  `pnpm test` runs both tiers.

> **Windows port note:** the browser tier pins the Vitest server to port
> `51890` (see `vitest.config.ts`). Vite only retries auto-assigned ports on
> `EADDRINUSE`, not on `EACCES`, so a random port landing in a Windows
> Hyper-V/WSL reserved range hard-fails. If `51890` is taken on your machine,
> change that one line locally; it is inert on Linux/CI.

### Other scripts

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `pnpm build`        | Bundle with tsup (ESM + CJS + IIFE)       |
| `pnpm lint`         | ESLint (flat config, `eslint.config.js`)  |
| `pnpm typecheck`    | `tsc --noEmit`                            |
| `pnpm format`       | Prettier write                            |
| `pnpm format:check` | Prettier check (CI gate)                  |
| `pnpm size`         | `size-limit` — enforces the bundle budget |

## Project map (`src/`)

The code is split into **pure** modules (no `document`/`window`/`fetch`/DOM
types at runtime — unit-tested in Node) and **browser-bound** modules
(exercised by the browser tier).

**Pure**

- `types.ts` — public types: `ImageFormat`, `ResizeOptions`, `FromURLOptions`, `Size`.
- `options.ts` — option validation/normalization and the legacy positional-args
  mapping (with the one-time deprecation warning). Produces `NormalizedOptions`.
- `geometry.ts` — target-dimension math (`resolveSize`) and the `MAX_PIXELS`
  decompression-bomb cap.
- `mime.ts` — format↔mime maps, encodability checks, output-mime resolution.
- `errors.ts` — typed error classes (all extend `ImageProcessError`) plus
  `rehydrate`, which rebuilds a typed error from a plain `{ name, message }`
  that crossed the worker/pipeline boundary so `instanceof` works on both paths.
- `core.ts` — the single, self-contained resize→encode pipeline (`runPipeline`).
  It touches only globals available in both window and worker and references
  nothing outside its own scope, so `worker-host.ts` can stringify it into a
  Worker. Change it carefully: it is shared verbatim by both execution paths.

**Browser-bound**

- `decode.ts` — decodes a blob to a drawable image (`createImageBitmap`, with an
  `HTMLImageElement`/object-URL fallback), applies EXIF orientation, and hosts
  the `assertBrowserEnv` SSR guard.
- `pipeline.ts` — main-thread wrapper (`processBitmap`) around `runPipeline`,
  plus the `makeCanvas` abstraction (OffscreenCanvas or `<canvas>`).
- `worker-entry.ts` — the stringified Worker body: an `onmessage` wrapper around
  `createImageBitmap` + the injected `runPipeline`. Runs only inside a Worker.
- `worker-host.ts` — main-thread host for the opt-in worker path: lazy singleton
  Worker, `id`/pending-map correlation, abort handling, and silent fallback
  (returns `null` when the worker path is unavailable so the caller uses the
  main thread).
- `fromBlob.ts` / `fromURL.ts` — public entry points (options-object signature
  plus deprecated positional overload).
- `blobToURL.ts` / `urlToBlob.ts` — Blob↔data-URL and URL→Blob helpers.
- `index.ts` — public barrel (functions, types, error classes).

## Rules

- **Conventional Commits.** commitlint enforces the format via a husky
  `commit-msg` hook. Because merges are **squash-only**, the **PR title** is the
  commit that matters — `feat:`/`fix:` drive releases, `feat!:` (or a
  `BREAKING CHANGE:` footer) is a major bump.
- **Zero runtime dependencies.** Non-negotiable.
- **Size budget.** ESM ≤ 3 kB, IIFE ≤ 3.5 kB (min+brotli), enforced by
  `pnpm size`. The budget is a ceiling: shrink code, don't raise the limit.
- **Tests required** for behavior changes. Add unit tests for pure logic and
  browser-tier tests for anything touching canvas/decode/worker.
- **TypeScript strict, browser-only.** No Node canvas support; fail fast with a
  clear error outside the browser.

## Release model

Releases are fully automated by **semantic-release**. Merging to `master`
triggers a release derived from the squash-commit message.

> **Never** hand-bump the `version` field in `package.json` — the in-repo
> version is intentionally stale; semantic-release injects the real version
> into the published tarball. The changelog lives in GitHub Releases, not in
> the repo. Just land a well-titled PR.

## Maintainer tasks

Owner-only, one-time setup that cannot live in the repo (npm trusted publishing,
branch protection, enabling Discussions, etc.) is tracked by the maintainer
outside the repository.

By contributing you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
