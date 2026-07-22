<!--
Keep this short. The PR TITLE must be a Conventional Commit — it becomes the
squash commit that semantic-release analyzes. `feat:`/`fix:` drive releases;
`feat!:` or a `BREAKING CHANGE:` footer triggers a major bump.
-->

## What & why

<!-- One or two sentences. Link the issue: -->

Closes #

## Type

<!-- Match your PR title prefix. -->

- [ ] `fix:` — bug fix (patch release)
- [ ] `feat:` — new feature (minor release)
- [ ] `feat!:` / `BREAKING CHANGE:` — breaking change (major release)
- [ ] `docs:` — documentation only
- [ ] `test:` — tests only
- [ ] `refactor:` / `perf:` — internal change, no API change
- [ ] `chore:` / `ci:` — tooling, build, or CI

## Checklist

- [ ] Tests added or updated for behavior changes
- [ ] `pnpm test` is green
- [ ] `pnpm lint && pnpm typecheck` are green
- [ ] No runtime dependencies added (zero-deps is non-negotiable)
- [ ] Size budget respected (`pnpm size`)
- [ ] Docs updated if the public API changed

## Breaking change?

<!--
If yes, describe the migration below. Copy it into the squash commit body as a
`BREAKING CHANGE:` footer so it lands in the changelog. If no, delete this
section.
-->
