# Agent tools

The workspace contains one deterministic validator,
`workspace_check.py`. It checks required files, unresolved Git merges, indexed
context paths, and local Markdown links. It does not modify the repository and
uses only the Python standard library.

Unix:

```sh
python3 tools/workspace_check.py
python3 tools/workspace_check.py --json
python3 -m unittest tools/test_workspace_check.py
```

PowerShell:

```powershell
python tools/workspace_check.py
python tools/workspace_check.py --json
python -m unittest tools/test_workspace_check.py
```

Use `py -3` instead of `python` on Windows when required.

Exit codes:

- `0`: all checks passed;
- `1`: a workspace check failed;
- `2`: the supplied repository root is invalid.
