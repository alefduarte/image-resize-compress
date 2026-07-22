# Spec 06 — Security & Supply Chain (incl. "npm signing")

## The "npm not signed" question — what to actually do

npm deprecated old-style PGP registry signatures; the modern mechanism is **provenance attestation** (Sigstore). Two layers, do both:

### 1. npm Trusted Publishing (OIDC) — preferred auth

- npmjs.com → package `image-resize-compress` → Settings → **Trusted Publisher** → GitHub Actions → repo `alefduarte/image-resize-compress`, workflow `release.yml`, environment blank (or `release` if using GH environments).
- Result: the release workflow authenticates via short-lived OIDC token exchange. **No `NPM_TOKEN` secret exists to steal.** Requires npm CLI ≥ 11.5 in the workflow (setup-node with node 22 ships new enough npm; verify).
- Also set package settings: **"Require two-factor authentication and disallow tokens"** → publishing possible ONLY via the trusted workflow + maintainer 2FA for settings changes.

### 2. Provenance attestation

- `id-token: write` permission in release workflow (spec 05) + `provenance=true` in `.npmrc` (or `npm publish --provenance` via semantic-release npm config).
- npm verifies and displays the green **Provenance** checkmark on the package page: cryptographic, publicly-logged (Rekor) proof that the tarball was built from a specific commit of this public repo by a specific workflow. Consumers verify with `npm audit signatures`.
- With Trusted Publishing enabled, recent npm CLI versions attach provenance automatically — still set the flag explicitly so intent is in-repo.

### Maintainer account hardening (manual checklist)

- [ ] npm account 2FA: auth-and-writes, FIDO2/passkey preferred over TOTP.
- [ ] Delete all existing legacy/classic npm tokens after Trusted Publishing works.
- [ ] GitHub account 2FA + require 2FA works only for orgs — personal repo: enable passkeys; protect `master` (spec 05); enable "Require approval for all outside collaborators" on Actions.
- [ ] GitHub Actions settings: default `GITHUB_TOKEN` permissions → read-only (workflows request what they need explicitly).

## Repo security files

### `SECURITY.md`

- Supported versions table (3.x supported, < 3 best-effort).
- Private reporting: enable GitHub **Private Vulnerability Reporting** in repo settings; SECURITY.md points there (no email roundtrips).
- Response SLA statement (e.g. acknowledge within 7 days). Keep it honest for a solo maintainer.

### Workflow hardening (with spec 05)

- Third-party actions pinned to commit SHAs.
- Release workflow minimal permissions; no `pull_request_target` anywhere; never check out PR code in privileged workflows.
- Dependabot covers `github-actions` ecosystem (spec 05).

## Library-level security (code)

Already specified in 02, listed here as the security checklist:

- [ ] Pixel-count limit (`ImageTooLargeError`) — decompression-bomb guard.
- [ ] No format relabeling — output `blob.type` always matches actual bytes.
- [ ] Content-type sanity check on `fromURL` responses (HTML error page ≠ image).
- [ ] Canvas re-encode strips EXIF/metadata from output — document as a **privacy feature** in README (GPS coordinates in phone photos do not survive processing).
- [ ] Zero runtime deps — the whole class of transitive-dependency compromise is structurally absent; state this in README + SECURITY.md as a design guarantee.
- [ ] Errors never embed raw response bodies or full data URLs (log-injection/PII hygiene).

Explicit non-issues (do not add code for): SSRF (library runs in the user's browser with the user's cookies — same-origin policy and CORS are the browser's job; document that `fromURL` fetches with the caller's credentials per their `fetchOptions`), CSP (no eval/inline anything), prototype pollution (no option merging beyond shallow known keys — keep it that way).

## Optional (recommended, cheap)

- OpenSSF **Scorecard** action (weekly, publishes badge) — free signal for the "is this lib trustworthy" comparison vs alternatives; add badge to README.
- `.github/CODEOWNERS`: `* @alefduarte` so all PRs auto-request review.

## Acceptance criteria

- [ ] Release published by CI shows Provenance on npmjs.com and `npm audit signatures` reports attested.
- [ ] No long-lived npm token in GitHub secrets; Trusted Publishing configured; package set to disallow token publishing.
- [ ] SECURITY.md merged; GitHub Private Vulnerability Reporting enabled.
- [ ] All third-party actions SHA-pinned; default workflow token read-only.
- [ ] README states: zero dependencies, provenance-signed releases, metadata-stripping behavior.
