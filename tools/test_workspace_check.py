"""Tests for the cross-platform workspace validator."""

from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("workspace_check.py")
SPEC = importlib.util.spec_from_file_location("workspace_check", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load workspace_check.py")
workspace_check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(workspace_check)


class WorkspaceCheckTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.repo_root = Path(self.temporary_directory.name)

        subprocess.run(
            ["git", "-C", str(self.repo_root), "init", "--quiet"],
            check=True,
            capture_output=True,
        )

        for relative_path in workspace_check.REQUIRED_PATHS:
            path = self.repo_root / relative_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("# Fixture\n", encoding="utf-8")

        (self.repo_root / "context/index.yaml").write_text(
            "version: 1\nsources:\n  - path: VISION.md\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def result(self, name: str) -> dict[str, object]:
        results = workspace_check.run_checks(self.repo_root)
        return next(result for result in results if result["name"] == name)

    def test_complete_fixture_passes(self) -> None:
        results = workspace_check.run_checks(self.repo_root)
        self.assertTrue(all(result["passed"] for result in results))

    def test_missing_required_file_fails(self) -> None:
        (self.repo_root / "VISION.md").unlink()

        result = self.result("required-files")

        self.assertFalse(result["passed"])
        self.assertIn("VISION.md", str(result["detail"]))

    def test_missing_indexed_path_fails(self) -> None:
        (self.repo_root / "context/index.yaml").write_text(
            "version: 1\nsources:\n  - path: missing.md\n",
            encoding="utf-8",
        )

        result = self.result("context-index")

        self.assertFalse(result["passed"])
        self.assertIn("missing.md", str(result["detail"]))

    def test_broken_markdown_link_fails(self) -> None:
        (self.repo_root / "README.md").write_text(
            "[Missing](missing.md)\n",
            encoding="utf-8",
        )

        result = self.result("markdown-links")

        self.assertFalse(result["passed"])
        self.assertIn("README.md -> missing.md", str(result["detail"]))


if __name__ == "__main__":
    unittest.main()
