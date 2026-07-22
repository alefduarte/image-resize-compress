# Maintainer checklist — manual steps for CI/CD + supply-chain (specs 05 & 06)

Everything the repo owner (`@alefduarte`) must do **by hand** in the npmjs.com
and GitHub web UIs. The repo files (workflows, `.releaserc.json`, `.npmrc`,
commitlint, husky, dependabot, `SECURITY.md`) are already committed on
`feat/v3`; the items below cannot be committed to the repo and must be clicked.

Do these in order. Items marked **BEFORE FIRST MERGE** must be done before the
`feat/v3` PR is squash-merged to `master`, or the first automated release will
misbehave.

---

## 0. Git baseline — v2.1.1 tag (verified: no action needed)

semantic-release computes the next version from the last release tag. That
baseline must exist before the first automated release.

**Finding (checked on 2026-07-22):** the baseline tag **already exists**, local
and remote — no tagging command is required.

```
$ git tag -l
2.0.0
2.1.0
v2.1.0
v2.1.1        <-- baseline present locally

$ git ls-remote --tags origin
a46c8df5...  refs/tags/v2.1.1        <-- annotated tag on origin
286b6b18...  refs/tags/v2.1.1^{}     <-- dereferences to commit 286b6b18
```

- The `v`-prefixed tag `v2.1.1` is the one semantic-release will use: its
  default `tagFormat` is `v${version}`.
- No need to run the fallback `git tag v2.1.1 c154290 && git push origin v2.1.1`
  — the tag is present and pushed. (Kept here only as the recovery command if a
  future rewrite ever drops it.)

- [ ] (Optional sanity) re-run `git tag -l` and confirm `v2.1.1` is still listed
      immediately before merging.

---

## 1. First merge — PR title and squash (BEFORE FIRST MERGE)

The `feat/v3` branch is a **breaking** release (quality-scale normalization,
`bmp`/`gif` output removal, `blobToURL` cap removal, new error types). The repo
version is still `2.1.1` and must **not** be hand-bumped — semantic-release
derives `3.0.0` from the merge commit message.

Because merges are squash-only, the **PR title becomes the single commit** that
semantic-release analyzes. It must carry a breaking-change marker:

- [ ] Set the `feat/v3` PR title to a breaking Conventional Commit, e.g.:

      ```
      feat!: v3 — options-object API, robust decode, provenance-signed releases
      ```

      The `!` after the type is what makes semantic-release compute a **major**
      bump (`2.1.1` -> `3.0.0`). A `BREAKING CHANGE:` footer in the squash body
      works too, but the `!` in the title is the reliable path.

- [ ] Squash-merge (not merge-commit, not rebase). See section 4 to enforce
      squash-only first.

---

## 2. npm Trusted Publishing (OIDC) — preferred auth (BEFORE FIRST MERGE)

Gives the release workflow token-free publishing. There is no `NPM_TOKEN`
secret to steal.

- [x] Sign in at <https://www.npmjs.com> as the package owner.
- [x] Go to the package page: <https://www.npmjs.com/package/image-resize-compress>
- [x] Click **Settings** (package settings tab).
- [x] Find **Trusted Publisher** → **GitHub Actions** → **Add**.
- [x] Enter exactly:
  - **Organization or user:** `alefduarte`
  - **Repository:** `image-resize-compress`
  - **Workflow filename:** `release.yml`
  - **Environment:** leave **blank** (the release job does not use a GitHub
    Environment).
- [x] Save.

Result: `release.yml` (which already has `id-token: write` and runs
`npm i -g npm@latest` to get npm ≥ 11.5) authenticates via short-lived OIDC.

> **Runtime note to watch on the first release:** confirm
> `@semantic-release/npm` v25 skips its `NPM_TOKEN` check under OIDC trusted
> publishing. If `verifyConditions` still demands a token, either upgrade the
> plugin or use the token fallback in section 2a. This only surfaces after
> trusted publishing is wired up, so it is a first-run check, not a file change.

### 2a. Token fallback (only if Trusted Publishing cannot be enabled)

If npm org/account settings block trusted publishing:

- [x] npmjs.com → **Access Tokens** → **Generate New Token** → **Granular
      Access Token**, scoped to **only** the `image-resize-compress` package,
      **Read and write**, short expiry.
- [x] GitHub repo → **Settings** → **Secrets and variables** → **Actions** →
      **New repository secret**, name **`NPM_TOKEN`**.
- [x] Add `NPM_TOKEN: ${{ secrets.NPM_TOKEN }}` to the `env:` of the **Release**
      step in `.github/workflows/release.yml`.

Prefer trusted publishing; delete the token (section 3) once OIDC works.

---

## 3. npm account hardening (after Trusted Publishing works)

- [x] Enable npm account 2FA for **authorization and writes**:
      npmjs.com → **Account** → **Two-Factor Authentication** → prefer
      **FIDO2 / passkey** over TOTP.
- [x] Package setting **"Require two-factor authentication and disallow
      tokens"**: package **Settings** → **Publishing access** →
      **Require two-factor authentication and disallow tokens** → Save.
      Publishing is then possible **only** through the trusted workflow, and
      settings changes require maintainer 2FA.
- [x] **Delete all legacy/classic npm tokens:** npmjs.com → **Access Tokens** →
      revoke every classic/automation token (and the fallback granular token
      from 2a if trusted publishing succeeded).

---

## 4. GitHub repository settings

### 4a. Merge strategy (BEFORE FIRST MERGE)

Repo → **Settings** → **General** → **Pull Requests**:

- [x] Enable **Allow squash merging**.
- [x] Under squash merging, set **default commit message** to **"Pull request
      title"** (so the enforced PR title lands verbatim as the squash commit).
- [x] **Disable Allow merge commits.**
- [x] **Disable Allow rebase merging.**

> **Why squash-only:** semantic-release computes versions and the changelog
> from the commits that land on `master`. The pipeline's guarantee is that the
> only commit landing there is the squash commit whose message = the PR title,
> already validated by the `pr-title.yml` check. A **merge commit** brings all
> individual (unvalidated — commitlint deliberately skips them) PR commits
> onto master: a stray `fix:` in WIP commits triggers an unintended release, a
> mistaken `feat!:` triggers a major bump, and noise pollutes the changelog.
> A **rebase merge** is worse: it replays every unvalidated commit verbatim
> and the validated PR title never lands at all. Squash-only = exactly one
> validated conventional commit per PR.

### 4b. Branch protection on `master` (BEFORE FIRST MERGE)

Repo → **Settings** → **Branches** → **Add branch ruleset** (or classic
**Branch protection rule**) targeting `master`:

- [x] **Require status checks to pass before merging** → `Verify` (GitHub
      Actions) added to the ruleset via API on 2026-07-22.
- [x] **Require a pull request before merging** (no direct pushes by humans).
      Review requirements set to zero approvals / no code-owner review / no
      last-push approval — a solo maintainer cannot approve their own PRs
      (GitHub ignores author approvals), so any review requirement would
      deadlock every PR. The real gates are the required `Verify` check and
      the PR-title check.
- [x] **Do not allow force pushes.**
- [x] **Do not allow deletions.**

> **RESOLVED — semantic-release vs. branch protection.** The original plan
> (`@semantic-release/git` pushing a CHANGELOG + version commit to `master`)
> conflicted with "require a pull request", and GitHub does **not** allow
> adding the GitHub Actions app to a ruleset bypass list on a personal repo
> (API rejects: "Actor GitHub Actions integration must be part of the ruleset
> source or owner organization"). Resolution (2026-07-22): dropped the
> `@semantic-release/git` and `@semantic-release/changelog` plugins entirely.
> Nothing pushes to `master` during a release; release notes live in the
> GitHub Release, and `@semantic-release/npm` injects the version into the
> published tarball. The in-repo `package.json` version stays stale by design
> — never hand-bump it.

### 4c. Actions default permissions

Repo → **Settings** → **Actions** → **General**:

- [x] **Workflow permissions** → select **Read repository contents and packages
      permissions** (default `GITHUB_TOKEN` read-only). The workflows request
      the writes they need explicitly via per-job `permissions:`.
- [x] **Fork pull request workflows from outside collaborators** → set to
      **Require approval for all outside collaborators** (or all external
      contributors).

### 4d. Private Vulnerability Reporting

Repo → **Settings** → **Security** (or **Code security and analysis**):

- [x] Enable **Private vulnerability reporting**. `SECURITY.md` already points
      contributors to the Security tab's "Report a vulnerability" flow.

### 4e. Discussions (needed by spec 07)

- [x] Repo → **Settings** → **General** → **Features** → enable
      **Discussions**. Spec 07 routes the issue-template contact link to
      Discussions so bug issues stay actionable; the link is dead until
      Discussions is on.

### 4f. GitHub account 2FA

- [ ] Enable 2FA on the maintainer's GitHub account (passkey preferred). (Org
      "require 2FA" does not apply to a personal repo.)

---

## 5. Post–first-release verification (specs 05 & 06 acceptance)

After the first `feat!:` squash merge triggers a release:

- [ ] npmjs.com package page shows the green **Provenance** badge on `3.0.0`.
- [ ] `npm audit signatures` (in a fresh install of the package) reports the
      release as **attested**.
- [ ] A **GitHub Release** for `v3.0.0` exists with generated notes (this is
      the changelog — no `CHANGELOG.md` is committed; the git/changelog
      plugins were removed, see §4b).
- [ ] **No `NPM_TOKEN`** remains in repo secrets (if trusted publishing worked).
- [ ] Deliberately push a red PR (failing test/lint/size) and confirm the
      required **`Verify`** check blocks merge; then revert.
- [ ] Open a PR with a non-conventional title and confirm the **PR Title**
      check fails; push a bad commit message locally and confirm the husky
      `commit-msg` hook rejects it.

---

## 6. Optional (spec 06 "recommended, cheap" — not yet in-repo)

Not built by this task; add later if desired:

- [ ] **OpenSSF Scorecard** action (weekly) + README badge — third-party
      trust signal.
- [ ] `.github/CODEOWNERS` with `* @alefduarte` so all PRs auto-request review.

---

## Quick reference — what is already in the repo vs. manual

| Area                                            | In-repo (done)        | Manual (this checklist)                     |
| ----------------------------------------------- | --------------------- | ------------------------------------------- |
| CI / release / PR-title workflows               | yes                   | enable required check, merge settings       |
| `.releaserc.json`, `.npmrc` (`provenance=true`) | yes                   | trusted publisher, 2FA/disallow-tokens      |
| commitlint + husky `commit-msg`                 | yes                   | —                                           |
| dependabot (npm grouped + github-actions)       | yes                   | —                                           |
| `SECURITY.md`                                   | yes                   | enable Private Vulnerability Reporting      |
| Version bump to 3.0.0                           | no (semantic-release) | set `feat!:` PR title, squash-merge         |
| Discussions / CODEOWNERS / Scorecard            | no                    | enable Discussions (spec 07); rest optional |
