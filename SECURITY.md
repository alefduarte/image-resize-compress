# Security Policy

## Supported versions

`image-resize-compress` follows semantic versioning. Security fixes are
released for the current major line. Older majors receive best-effort fixes
only.

| Version | Supported             |
| ------- | --------------------- |
| 3.x     | :white_check_mark:    |
| < 3.0   | :warning: Best effort |

## Reporting a vulnerability

Please **do not** open a public issue for security reports.

Use GitHub's **Private Vulnerability Reporting** for this repository:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Fill in the advisory form with a description, reproduction steps, and
   affected versions.

This keeps the report private until a fix is available and avoids email
round-trips.

## Response expectations

This project is maintained by a single volunteer maintainer, so please set
expectations accordingly:

- **Acknowledgement:** within 7 days of the report.
- **Assessment and triage:** as soon as reasonably possible after
  acknowledgement.
- **Fix and disclosure:** coordinated with the reporter once a fix is ready; a
  GitHub Security Advisory and patched release will be published together.

If you do not receive an acknowledgement within 7 days, feel free to send a
polite follow-up through the same private advisory thread.

## Supply-chain guarantees

Security is a design goal of this library, not an afterthought:

- **Zero runtime dependencies.** The package ships no third-party runtime code,
  so the entire class of transitive-dependency compromise is structurally
  absent. There is no dependency tree to audit at install time.
- **Provenance-signed releases.** Every release is published from GitHub Actions
  with npm [provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
  (Sigstore). npmjs.com shows a green **Provenance** badge, giving cryptographic,
  publicly logged proof that the tarball was built from a specific commit of this
  public repository by the release workflow. Consumers can verify with:

  ```sh
  npm audit signatures
  ```

- **Trusted publishing (OIDC).** Releases authenticate to npm via short-lived
  OIDC token exchange rather than a long-lived automation token, so there is no
  publishing token to leak.
- **Metadata stripping.** Because processing re-encodes images through a canvas,
  EXIF/metadata (including GPS coordinates embedded by phone cameras) does not
  survive the pipeline. This is a privacy feature of the library.

## Scope notes

`image-resize-compress` runs entirely in the user's browser. When `fromURL`
fetches a remote image, it uses the caller's own credentials and is subject to
the browser's same-origin policy and CORS — request access control is the
browser's responsibility, not the library's.
