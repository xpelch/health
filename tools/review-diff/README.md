# Diff review helper

`review-diff.ps1` summarizes a Git change without modifying the worktree. It
classifies changed files, highlights health-specific review surfaces, and
suggests validation commands.

With no arguments it reviews tracked and untracked working-tree changes against
`HEAD`. To review commits, provide both `-Base` and `-Head`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/review-diff/review-diff.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/review-diff/review-diff.ps1 -Base main -Head HEAD -Format json
```

Use `-Out <relative-path>` to write a non-overwriting report inside the
repository.

Exit codes:

- `0`: report generated;
- `10`: repository or revision validation failed;
- `30`: output path is unsafe or already exists.

Run the self-test with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/review-diff/test-review-diff.ps1
```
