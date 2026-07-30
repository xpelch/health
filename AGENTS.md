# Health repository agent guide

This file defines how coding agents work in this repository. It supplements the
general engineering rules supplied by the host environment. The most specific
instruction applies when rules conflict.

## Mission

Build a vendor-neutral, privacy-preserving health data foundation that serves
the public good. The project should reduce dependence on proprietary health
ecosystems and remain useful as a base for different kinds of applications.

The current product is a local-first phone application. Its first supported
metrics are steps, heart rate, sleep, and workouts. Device and provider support
belongs behind adapters; vendor concepts must not leak into the domain model.

## Start here

Before changing the repository:

1. Read `agent-context/IDENTITY.md`.
2. Read `VISION.md` and `README.md`.
3. Use `context/.meta/index.yaml` to find the canonical documentation for the
   affected area.
4. Inspect the existing implementation and tests before proposing new
   abstractions.
5. Run `tools/workspace-check/workspace-check.ps1`.

## Canonical sources

The `docs/` directory is authoritative:

- `docs/product-scope.md` defines the product boundary and MVP.
- `docs/architecture.md` defines components and dependency direction.
- `docs/data-model.md` defines vendor-neutral health records.
- `docs/synchronization.md` defines import, deduplication, and checkpoints.
- `docs/extensibility.md` defines source, destination, and identity extension
  points.
- `docs/privacy-and-security.md` defines sensitive-data safeguards.
- `docs/adr/` records durable architectural decisions.

Files in `context/` route agents to those sources and capture only concise
operational cautions. They must not become a competing specification.

## Architectural invariants

- The MVP works locally on the phone without an account or backend.
- Health records are sensitive. Never place real health data, access tokens,
  credentials, or personal identifiers in source control, prompts, fixtures,
  logs, screenshots, or tool output.
- Use clearly synthetic data in tests and examples.
- Keep the domain model independent of Apple, Google, watch, and device SDK
  types.
- Source adapters read external health records and map them into the canonical
  model.
- Destination adapters export canonical records. Identity providers remain an
  optional boundary until a feature requires them.
- Synchronization must be incremental, idempotent, observable, and safe to
  retry.
- Permission requests must be granular and explain their purpose.
- Do not make medical, diagnostic, or treatment claims.
- A future extension point is not a reason to create an unused abstraction.

## Working protocol

For a non-trivial change:

1. Inspect `git status`, relevant files, and existing conventions.
2. Write a bounded plan using `templates/iteration-plan.md` when the change has
   multiple independently verifiable steps.
3. Implement the smallest coherent slice.
4. Add or update behavior-focused tests.
5. Run the narrowest relevant checks, then the broader available checks.
6. Run `tools/review-diff/review-diff.ps1`.
7. Summarize behavior, evidence, risks, and follow-up work.

Use `playbooks/implement-iteration.md` for normal delivery,
`playbooks/review-change.md` for a focused review, and
`playbooks/recover-from-failure.md` when work leaves the repository in an
uncertain state.

## Change discipline

- Preserve existing user changes and avoid unrelated formatting.
- Prefer explicit, readable code over framework tricks.
- Reuse existing domain concepts and utilities.
- Keep business rules separate from SDK, storage, network, and UI code.
- Validate all external input at its boundary.
- Do not weaken checks or tests to make a change pass.
- Do not commit generated reports or transient session logs.
- Do not add dependencies without checking maintenance, licensing, privacy,
  security, size, and platform impact.

## Git and external actions

- Keep commits focused and reviewable.
- Suggested branch names are `feat/<topic>`, `fix/<topic>`, and `docs/<topic>`.
- Do not rewrite shared history or discard uncommitted work.
- Push, publish, open pull requests, or modify external systems only when the
  user has authorized that action.

## Validation

Use the checks that exist in the repository. When a mobile project is present,
prefer its declared package scripts over invented commands. At minimum:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/workspace-check/workspace-check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/review-diff/review-diff.ps1
git diff --check
```

Report checks that could not run and why. Never present an unexecuted check as
passing.

## Durable knowledge

Architectural decisions belong in `docs/adr/`. Product and technical contracts
belong in the relevant canonical document. Add a short context note only when
it helps future agents find a constraint or avoid a recurring mistake, then
register it in `context/.meta/index.yaml`.

Session notes are optional and must contain no health data or secrets. If they
are useful for multi-step work, use `templates/session-summary.md`; generated
session files remain ignored by Git.
