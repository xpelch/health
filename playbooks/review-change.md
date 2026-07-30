# Review a change

Use this playbook for a focused code or documentation review.

## 1. Define the review range

Identify the base and head revisions or the uncommitted diff. Confirm whether
the task is read-only; a review request alone does not authorize fixes.

## 2. Reconstruct intent

Read the request, affected canonical documents, implementation, and tests.
Describe the behavior the change appears to introduce before judging its
quality.

## 3. Review by risk

Check the highest-risk areas first:

1. Health data exposure, logging, retention, and deletion.
2. Permission and authorization boundaries.
3. Provider-specific concepts leaking into the canonical model.
4. Synchronization retry safety, deduplication, and checkpoint correctness.
5. Silent loss, mutation, or misclassification of health records.
6. Missing validation of external records.
7. Tests that omit failure and edge cases.
8. Dependency, licensing, and platform impact.

Then check clarity, duplication, unnecessary abstractions, and repository
conventions.

## 4. Gather evidence

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/review-diff/review-diff.ps1
git diff --check
```

Run relevant tests when the environment supports them. Do not infer that a test
passes from reading it.

## 5. Report

List actionable findings in descending severity. Each finding should identify
the affected file and explain the concrete failure mode. Separate confirmed
defects from questions or optional improvements.

If there are no findings, say so and state any residual test or coverage gaps.
