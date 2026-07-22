# Spec 05 — CI/CD, semantic-release, commitlint

## Problem

No workflows exist (`.github/` has only dependabot.yml). Releases are manual `npm publish` from a laptop: no gate, no changelog automation, no provenance, version bumps by hand.

## Workflows

### `.github/workflows/ci.yml` — on `pull_request` + `push` to `master`

Single job `verify` (matrix not needed for a browser lib; Node 22 only):

1. checkout → pnpm setup (`pnpm/action-setup`) → `actions/setup-node` (node 22, cache pnpm) → `pnpm install --frozen-lockfile`
2. `pnpm lint` (eslint) + `pnpm format:check` (`prettier --check`, add script)
3. `pnpm typecheck` (add script: `tsc --noEmit`)
4. `pnpm test:unit`
5. `npx playwright install chromium --with-deps` → `pnpm test:browser`
6. `pnpm build` → `pnpm size` → `npx publint` → `npx attw --pack`

Concurrency group cancels superseded runs on the same PR. Total target: < 4 min.

### `.github/workflows/release.yml` — on `push` to `master`

- `if: github.repository == 'alefduarte/image-resize-compress'` (forks don't try to release)
- Needs CI green: either `workflow_run` on CI success, or simpler — rerun the verify steps then release in the same workflow. **Choose simple: one workflow with `verify` job then `release` job (`needs: verify`).** So: ci.yml runs on PRs only; release.yml on master push does verify + release.
- Permissions: `contents: write` (tags/changelog/GH release), `issues: write`, `pull-requests: write` (release comments), `id-token: write` (**provenance — required**).
- Steps: install → build → `npx semantic-release`.

### semantic-release config (`.releaserc.json`)

```jsonc
{
  "branches": ["master"],
  "plugins": [
    "@semantic-release/commit-analyzer", // conventional commits -> semver bump
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    ["@semantic-release/npm", {}], // publishes; provenance via npm config
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    "@semantic-release/github", // GH release + comments on issues/PRs
  ],
}
```

- Add `.npmrc` in repo root: `provenance=true` (or `NPM_CONFIG_PROVENANCE=true` env in workflow). Details + auth model in spec 06 (prefer **npm Trusted Publishing / OIDC — no NPM_TOKEN secret at all**; if npm org/settings block it, fall back to a granular automation token secret).
- Delete `generate-changelog` dev-dep (superseded).
- First release after merge: current version is 2.1.1; ensure the breaking-change commit footer (`BREAKING CHANGE:`) exists so semantic-release computes 3.0.0. Verify last git tag matches v2.1.1 (`git tag -l`); if tags are missing, tag `v2.1.1` on the release commit `c154290` first — semantic-release needs the baseline.

## Commit rules

### commitlint

- Dev deps: `@commitlint/cli`, `@commitlint/config-conventional`; `commitlint.config.mjs` extending `config-conventional`.
- Local: `husky` with `commit-msg` hook → `npx commitlint --edit $1`. Keep hooks minimal — no pre-commit lint-staged in v3 (CI catches it; don't slow down commits). `prepare: "husky"` script.
- CI: PRs are squash-merged (enforce in repo settings), so the **PR title becomes the commit that semantic-release reads**. Add `.github/workflows/pr-title.yml` using `amannn/action-semantic-pull-request` — this is the gate that actually matters. commitlint on individual PR commits: skip (noise for contributors; title is what lands).

### Repo settings (manual checklist for maintainer, document in CONTRIBUTING)

- Squash merge ONLY (disable merge commits + rebase merge); default squash message = PR title.
- Branch protection on `master`: require CI check, require PR, no force push.

## Dependabot upgrade

Extend existing `.github/dependabot.yml`:

- Add `package-ecosystem: github-actions` (weekly).
- Group npm dev-dep minor/patch updates into one weekly PR (`groups:`) — kills the current PR spam that led to stale merges.
- Dependabot commits use `chore(deps):` prefix (`commit-message.prefix`) so semantic-release ignores them for versioning.

## Action hygiene

- Pin all third-party actions to full commit SHAs (`uses: owner/action@<sha> # vX`), official `actions/*` at major tags is acceptable. (Supply-chain rationale in spec 06.)

## Acceptance criteria

- [ ] PR with failing test/lint/size/attw cannot merge (branch protection + required check documented; workflow proven red on a deliberate breakage, then reverted).
- [ ] Merging `feat!:`-titled squash PR to master auto-publishes 3.0.0 to npm with changelog, git tag, GitHub Release.
- [ ] Published version shows **Provenance** badge on npmjs.com (spec 06 verification).
- [ ] Bad commit message locally rejected by husky; bad PR title rejected by pr-title workflow.
- [ ] `CHANGELOG.md` generated and committed by the bot with `[skip ci]`.
- [ ] Dependabot opens grouped weekly PRs incl. github-actions ecosystem.
- [ ] No `NPM_TOKEN` in repo secrets if Trusted Publishing works (preferred path).
