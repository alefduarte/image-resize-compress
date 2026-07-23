# CLAUDE.md — project invariants

This repo is maintained with AI-assisted tooling. Honor these guardrails on
every change; they are non-negotiable.

- **Zero runtime dependencies.** Never add a `dependencies` entry. Everything
  ships as `devDependencies` only.
- **Size budget.** ESM ≤ 3.05 kB, IIFE ≤ 3.5 kB (min+brotli), enforced by
  `pnpm size`. The budget is a ceiling — shrink code, never raise the limit.
- **Browser-only.** No Node canvas support. Outside a browser, fail fast with
  `EnvironmentError`. Do not add SSR/Node execution paths.
- **Pure vs. browser-bound split.** `options.ts`, `geometry.ts`, `mime.ts`, and
  `errors.ts` must not touch `document`/`window`/`fetch` or DOM types at runtime
  (they are unit-tested in Node). `core.ts` (`runPipeline`) must reference
  nothing outside its own scope — it is stringified into the Web Worker.
- **Browser-tier tests are the source of truth.** `pnpm test:unit` is the fast
  loop; behavioral correctness is only real once `pnpm test:browser` (Chromium)
  passes. Add tests for behavior changes.
- **Conventional Commits.** Merges are squash-only, so the PR title is the
  commit that ships. `feat:`/`fix:` drive releases; `feat!:` is a major bump.
- **Never hand-bump the `version` field.** semantic-release stamps the real
  version into the published tarball; the in-repo value stays stale by design.
  The changelog lives in GitHub Releases, not the repo.

See `CONTRIBUTING.md` for setup and the module map.
