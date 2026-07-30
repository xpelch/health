# Implement a bounded iteration

Use this playbook for a feature, fix, or documentation iteration with a clear
outcome.

## 1. Establish the boundary

- Read `AGENTS.md`, `agent-context/IDENTITY.md`, and the relevant entries in
  `context/.meta/index.yaml`.
- Inspect `git status` and preserve unrelated user work.
- State the behavior to add or change, its exclusions, and its acceptance
  evidence.
- For multi-step work, copy `templates/iteration-plan.md` into a temporary
  session note under `logs/sessions/`.

Stop if the requested behavior conflicts with privacy rules, the public-good
mission, or a canonical architectural decision. Surface the conflict before
implementation.

## 2. Inspect before designing

- Find existing domain concepts, adapters, tests, and naming conventions.
- Trace input from the external boundary to the canonical model and its
  consumer.
- Identify permission, retry, deduplication, and deletion implications.
- Choose the smallest safe change that produces useful behavior.

## 3. Implement

- Keep provider SDK types inside infrastructure adapters.
- Keep health-domain rules pure where practical.
- Validate external records before normalization.
- Make unsupported or failed capabilities explicit.
- Use synthetic fixtures and privacy-safe diagnostics.
- Avoid dependencies and abstractions that the iteration does not require.

## 4. Verify

- Run tests for changed behavior, including a meaningful failure path.
- Run declared linting and type checks when available.
- Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/workspace-check/workspace-check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/review-diff/review-diff.ps1
git diff --check
```

- Inspect the full diff for unrelated changes and sensitive information.

## 5. Hand off

Report:

- the user-visible or architectural outcome;
- files and contracts changed;
- checks run and their results;
- known limitations and risks;
- the smallest useful follow-up.

Use `templates/pr-summary.md` when preparing a pull request.
