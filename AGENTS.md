# Health agent contract

## Objective

Advance Health as a local-first, vendor-neutral foundation for personal health
data. Changes must remain understandable and maintainable by human
contributors.

## Sources of truth

Read `VISION.md` and the relevant paths in `context/index.yaml` before changing
behavior. The index only routes to canonical documentation; do not duplicate
product or architecture rules elsewhere.

## Invariants

- The MVP runs on the phone without an account or backend.
- Initial metrics are steps, heart rate, sleep, and workouts.
- Provider SDK types stay inside source or destination adapters.
- The core uses canonical health records and does not branch on vendor names.
- Synchronization is incremental, idempotent, observable, and retry-safe.
- Permissions are granular and denial or unavailability is handled explicitly.
- Tests and examples use clearly synthetic records.
- Health values, personal identifiers, credentials, and tokens never enter
  source control or diagnostic output.
- The project does not make diagnostic or treatment claims.
- Add an extension point only when current behavior needs it.

## Working agreement

Before editing, inspect the repository, existing conventions, tests, and
uncommitted changes. For multi-step work, use `templates/iteration.md`.

Implement the smallest coherent change that satisfies the request. Keep domain
rules separate from platform SDKs, storage, networking, UI, and concurrency.
Validate external records at their boundary and make failure states explicit.

After editing:

1. Run tests for the changed behavior and a meaningful failure path.
2. Run the repository's declared lint, type, and build commands when relevant.
3. Run the workspace validation commands below.
4. Inspect the complete diff for unrelated changes and sensitive information.
5. Report the outcome, executed checks, remaining risks, and deferred work.

If a command fails or repository ownership is unclear, stop further mutation.
Inspect `git status` and the diff, identify the root cause, then either recover
without discarding user work or report the exact blocker.

## Permissions

Inspection, local edits, and non-destructive validation are allowed when the
user asks to modify or build. Publishing, external writes, destructive actions,
history rewriting, and material scope expansion require explicit authorization.

## Cross-platform validation

The workspace tool uses only the Python standard library and supports Python
3.10 or newer.

Unix:

```sh
python3 tools/workspace_check.py
python3 -m unittest tools/test_workspace_check.py
git diff --check
```

PowerShell:

```powershell
python tools/workspace_check.py
python -m unittest tools/test_workspace_check.py
git diff --check
```

If `python` is not the Python 3 executable on Windows, use `py -3`.
