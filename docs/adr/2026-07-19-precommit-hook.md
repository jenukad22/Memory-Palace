# ADR: Check-only pre-commit hook (dropped lint-staged)

**Date:** 2026-07-19
**Status:** Accepted

## Context

The pre-commit hook originally ran `lint-staged` (eslint `--fix` + prettier
`--write` on staged files), then `typecheck` and `test`. On this environment
(Windows 11, Node 24) `lint-staged` hung **nondeterministically** for 5–10
minutes per commit — on `eslint --fix` in one run, on `prettier --write` in
another — and each killed run left a dangling `lint-staged automatic backup`
stash.

Investigation showed the checks themselves are fine:

- `eslint --fix <file>` runs in **milliseconds** on every file individually and
  via `eslint .`.
- `prettier --check .` / `prettier --write .` run in ~1–2s.
- The hang reproduced with `lint-staged --no-stash --concurrent false`, so it is
  **not** the stash or task concurrency — it is `lint-staged`'s child-process
  orchestration (spawn/pipe handling) on Node 24 + Windows.

The dangling stash is the real hazard: `lint-staged` stashes the unstaged
working tree, so a run killed mid-stash can lose uncommitted work.

## Decision

Drop `lint-staged`. Make the hook **check-only** — it never writes to the
working tree, so there is no stash and no data-loss path:

```sh
npx prettier --check .
npm run lint
npm run typecheck
npm run test
```

Total runtime ~7–10s, deterministic. `lint-staged` was removed from
`devDependencies`.

## Consequences

- **No auto-format on commit.** Formatting is enforced as a _gate_
  (`prettier --check`) instead of a fixer. Run `npm run format`
  (`prettier --write .`) before committing if the check fails. Editors with
  format-on-save keep this invisible in practice.
- Checks run over the whole project, not just staged files. The repo is small;
  this is fast and actually stronger (catches drift in unstaged files too).
- Zero dangling-stash / lost-work risk.
- CI (`.github/workflows/ci.yml`) remains the authoritative gate.

## Note on earlier bootstrap commits

The three commits before this decision (`chore: initial scaffold`,
`docs: db layer design spec`, `docs: db layer implementation plan`) were made
with the old hook; the two scaffold/spec commits used `--no-verify` because
`lint-staged` cannot run on a repo with no `HEAD`. All were verified green
manually (typecheck + lint + tests) before committing.
