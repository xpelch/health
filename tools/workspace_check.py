#!/usr/bin/env python3
"""Validate the Health agent workspace without modifying it."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote


REQUIRED_PATHS = (
    ".github/PULL_REQUEST_TEMPLATE.md",
    "AGENTS.md",
    "README.md",
    "VISION.md",
    "context/index.yaml",
    "docs/architecture.md",
    "docs/data-model.md",
    "docs/extensibility.md",
    "docs/privacy-and-security.md",
    "docs/product-scope.md",
    "docs/synchronization.md",
    "templates/iteration.md",
    "tools/README.md",
    "tools/test_workspace_check.py",
    "tools/workspace_check.py",
)

IGNORED_DIRECTORIES = {".git", ".expo", ".venv", "dist", "node_modules"}
MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
INDEXED_PATH = re.compile(r"^\s*(?:-\s*)?path:\s*(.+?)\s*$")
EXTERNAL_SCHEME = re.compile(r"^(?:https?|mailto|tel):", re.IGNORECASE)


def check_required_paths(repo_root: Path) -> tuple[bool, str]:
    missing = [path for path in REQUIRED_PATHS if not (repo_root / path).exists()]
    if missing:
        return False, f"Missing: {', '.join(missing)}"
    return True, "All required files are present."


def check_unresolved_merges(repo_root: Path) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "ls-files", "-u"],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return False, "Git is unavailable."

    if result.returncode != 0:
        detail = result.stderr.strip() or "Git could not inspect the worktree."
        return False, detail

    entries = [line for line in result.stdout.splitlines() if line.strip()]
    if entries:
        return False, f"{len(entries)} unresolved merge entries."
    return True, "No unresolved merge entries."


def indexed_paths(index_path: Path) -> list[str]:
    paths: list[str] = []
    for line in index_path.read_text(encoding="utf-8").splitlines():
        match = INDEXED_PATH.match(line)
        if match:
            paths.append(match.group(1).strip("\"'"))
    return paths


def check_context_index(repo_root: Path) -> tuple[bool, str]:
    index_path = repo_root / "context/index.yaml"
    if not index_path.is_file():
        return False, "context/index.yaml is missing."

    paths = indexed_paths(index_path)
    if not paths:
        return False, "The context index contains no paths."

    missing = [path for path in paths if not (repo_root / path).exists()]
    if missing:
        return False, f"Missing indexed paths: {', '.join(missing)}"
    return True, f"{len(paths)} indexed paths resolved."


def markdown_files(repo_root: Path) -> list[Path]:
    return [
        path
        for path in repo_root.rglob("*.md")
        if not IGNORED_DIRECTORIES.intersection(path.relative_to(repo_root).parts)
    ]


def link_target(raw_target: str) -> str:
    target = raw_target.strip()
    if target.startswith("<") and ">" in target:
        return target[1 : target.index(">")]
    return target.split(maxsplit=1)[0]


def check_markdown_links(repo_root: Path) -> tuple[bool, str]:
    broken: list[str] = []
    for markdown_file in markdown_files(repo_root):
        content = markdown_file.read_text(encoding="utf-8")
        for match in MARKDOWN_LINK.finditer(content):
            target = link_target(match.group(1))
            if not target or target.startswith("#") or EXTERNAL_SCHEME.match(target):
                continue

            path_text = unquote(target.split("#", maxsplit=1)[0])
            if not path_text:
                continue

            if path_text.startswith("/"):
                resolved = repo_root / path_text.lstrip("/")
            else:
                resolved = markdown_file.parent / path_text

            if not resolved.exists():
                source = markdown_file.relative_to(repo_root).as_posix()
                broken.append(f"{source} -> {target}")

    if broken:
        return False, f"Broken links: {'; '.join(broken)}"
    return True, "All local Markdown links resolved."


def run_checks(repo_root: Path) -> list[dict[str, object]]:
    checks = (
        ("required-files", check_required_paths),
        ("unresolved-merges", check_unresolved_merges),
        ("context-index", check_context_index),
        ("markdown-links", check_markdown_links),
    )
    return [
        {"name": name, "passed": passed, "detail": detail}
        for name, check in checks
        for passed, detail in (check(repo_root),)
    ]


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=default_root,
        help="Repository root. Defaults to the parent of tools/.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Render a machine-readable result.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.expanduser().resolve()
    if not repo_root.is_dir():
        print(f"Repository root does not exist: {repo_root}")
        return 2

    checks = run_checks(repo_root)
    failed = [check for check in checks if not check["passed"]]

    if args.json:
        print(
            json.dumps(
                {
                    "status": "failed" if failed else "passed",
                    "repository_root": str(repo_root),
                    "checks": checks,
                },
                indent=2,
            )
        )
    else:
        status = "failed" if failed else "passed"
        print(f"Workspace check: {status}")
        for check in checks:
            marker = "PASS" if check["passed"] else "FAIL"
            print(f"[{marker}] {check['name']}: {check['detail']}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
