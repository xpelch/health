# Recover from a failed iteration

Use this playbook when a command fails unexpectedly, the repository state is
uncertain, or an implementation approach proves unsafe.

## 1. Stop mutation

Do not continue applying speculative fixes. Do not reset, clean, rewrite
history, or discard files.

## 2. Capture the current state

Run read-only checks:

```powershell
git status --short
git diff --stat
git diff
powershell -NoProfile -ExecutionPolicy Bypass -File tools/workspace-check/workspace-check.ps1
```

Record the failed command, its exact error category, and which files were
intentionally changed. Never copy secrets or health data into the record.

## 3. Classify the failure

- **Implementation:** the design or code does not satisfy the contract.
- **Environment:** a tool, SDK, credential, simulator, or platform is missing.
- **Data contract:** an external record or platform behavior differs from the
  documented assumption.
- **Repository state:** unrelated changes, conflicts, or generated files
  prevent safe continuation.
- **Safety:** continuing could expose data, corrupt records, or perform an
  unauthorized external action.

## 4. Choose the narrowest recovery

- Fix an implementation problem only after identifying its root cause.
- For an environment problem, preserve the change and report the exact missing
  prerequisite.
- For a contract problem, update the plan and tests before code.
- For a repository-state problem, work around unrelated changes or ask the
  user to resolve ownership.
- For a safety problem, stop and request direction.

## 5. Re-verify

After recovery, rerun the command that failed and the narrowest relevant
regression checks. If confidence is not restored, hand off the repository state
without claiming completion.
