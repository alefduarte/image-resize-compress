# Spec 07 — Community, Docs, Maintainability

## Problem

No PR template, no issue templates, no CONTRIBUTING.md; README documents a broken CDN example and the soon-to-be-old positional API. Contributors have no path; users comparing against `browser-image-compression` see less polish.

## GitHub templates

### `.github/PULL_REQUEST_TEMPLATE.md`

Sections (short — long templates get deleted by submitters):

- **What & why** (link issue: `Closes #`)
- **Type**: checkbox list mapping to Conventional Commit types — reminder that **PR title must follow Conventional Commits** (it becomes the squash commit; `feat:`/`fix:` drive releases)
- **Checklist**: tests added/updated · `pnpm test` green · `pnpm lint && pnpm typecheck` green · no runtime deps added · size budget respected (`pnpm size`) · docs updated if API changed
- **Breaking change?** If yes, describe migration (goes into PR body → `BREAKING CHANGE:` footer of squash commit)

### Issue forms (`.github/ISSUE_TEMPLATE/`, YAML forms not md)

- `bug_report.yml`: version, browser + version, input format/size, code snippet (required), expected vs actual, reproduction link (StackBlitz/CodeSandbox encouraged — dropdown "can you share a repro?").
- `feature_request.yml`: problem, proposed API, "would this add bundle size?" awareness field.
- `config.yml`: blank issues off; contact link → GitHub Discussions (enable) for questions, so issues stay actionable.

### `CONTRIBUTING.md`

- Setup: pnpm only (`corepack enable`), `pnpm i`, `pnpm test:unit` for fast loop, `pnpm test:browser` needs `npx playwright install chromium`.
- Project map: one paragraph per src module (pure vs browser-bound split from spec 02).
- Rules: Conventional Commits (commitlint enforces; squash-merge means PR title matters most), zero runtime deps, size budget, tests required for behavior changes.
- Release model: "merge to master = release by semantic-release; never bump versions or edit CHANGELOG manually."

### Misc

- `.github/CODEOWNERS`: `* @alefduarte`.
- Code of Conduct: Contributor Covenant v2.1 as `CODE_OF_CONDUCT.md` (GitHub surfaces it; costs nothing).

## README overhaul

Keep the friendly tone; restructure:

1. **Hero**: one-line pitch + badges (npm version, min+gzip size via bundlephobia, CI status, coverage, **npm provenance**, OpenSSF scorecard if spec 06 adds it).
2. **Why this over browser-image-compression?** — honest comparison table (size ≤3 kB vs ~9 kB, zero deps, provenance-signed, URL input, opt-in zero-config web worker, real-browser test suite; theirs: `onProgress`). Include the spec 08 CSP note (`worker-src blob:`) and when `worker: true` is worth it (>~5 MB images, batches).
3. **Quickstart** with the v3 options API (spec 01), including `targetSize` as the headline example.
4. **API reference**: generated-quality but hand-written tables per function (params, defaults, errors thrown). Include error-classes section with `instanceof` example.
5. **Recipes**: file input → preview; enforce max upload size with `targetSize`; convert HEIC? (no — document unsupported, browsers can't decode; suggest detecting and telling users) ; abort on component unmount (React example); SSR note (Next.js: call only client-side, the `EnvironmentError` you'll see otherwise).
6. **Migrating to v3** section: table old positional → new options; quality-scale change called out in bold; bmp/gif removal rationale (browsers never actually encoded them — v2 output was mislabeled PNG).
7. **CDN usage** — fixed with real IIFE global (spec 04).
8. Compatibility table: needs `createImageBitmap` OR HTMLImageElement fallback path; effectively all evergreen browsers; no IE.
9. Update demo link/app to v3 API (separate repo `image-resize-compress-demo` — file an issue there; out of scope here).

## Maintainability extras

- `CLAUDE.md` (repo root, brief): project invariants for AI-assisted contributions — zero deps, size budget, pure/impure module split, conventional commits, "browser tier tests are the source of truth". This repo is maintained with AI tooling; encode the guardrails.
- Delete dead config: `.eslintrc.json` (superseded by `eslint.config.js` — both currently exist), `yarn.lock` (spec 04).
- Add `format:check` script; ensure prettier config covers specs/ and .github/.

## Acceptance criteria

- [ ] Opening a PR shows the template; new issue shows the two forms; blank issues disabled.
- [ ] CONTRIBUTING.md accurate — a fresh clone following it reaches green `pnpm test:unit` with no undocumented steps.
- [ ] README: no broken examples (CDN snippet works against built `dist/`), migration section present, comparison table present, all badges resolve.
- [ ] CODEOWNERS + CODE_OF_CONDUCT.md + CLAUDE.md merged.
- [ ] `.eslintrc.json` removed; lint still green.
