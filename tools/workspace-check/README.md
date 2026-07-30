# Workspace check

`workspace-check.ps1` performs a fast, read-only validation of the agent
workspace and its local Markdown links. It checks:

- required operating files;
- the Git worktree and unresolved merge entries;
- paths registered in the context index;
- relative links in Markdown files.

## Usage

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/workspace-check/workspace-check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/workspace-check/workspace-check.ps1 -Format json
```

Use `-Out <relative-path>` to save the result inside the repository. The tool
does not create missing parent directories and does not overwrite files.

Exit codes:

- `0`: all checks passed;
- `10`: the repository root or Git command is unavailable;
- `20`: one or more workspace checks failed;
- `30`: the requested output path is unsafe or already exists.

Run the self-test with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/workspace-check/test-workspace-check.ps1
```
