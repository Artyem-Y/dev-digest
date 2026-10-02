from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "append_insight.py"


class AppendInsightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.module_dir = self.root / "client"
        self.module_dir.mkdir()
        self.insights = self.module_dir / "INSIGHTS.md"
        self.insights.write_text("# Client insights\n\nExisting knowledge.\n", encoding="utf-8")

    def run_helper(self, *extra: str) -> subprocess.CompletedProcess[str]:
        args = [
            sys.executable,
            str(SCRIPT),
            "--project-root",
            str(self.root),
            "--module",
            "client",
            "--category",
            "boundary",
            "--title",
            "Shared contracts have two checked-in copies",
            "--evidence",
            "The client and server resolve @devdigest/shared to separate vendor trees.",
            "--implication",
            "Contract changes must update and verify both copies.",
            "--insight",
            "Treat the two vendor trees as one compatibility boundary.",
            "--date",
            "2026-09-18",
            *extra,
        ]
        return subprocess.run(args, capture_output=True, text=True, check=False)

    def test_append_preserves_existing_content_byte_for_byte(self) -> None:
        before = self.insights.read_bytes()

        result = self.run_helper()

        self.assertEqual(result.returncode, 0, result.stderr)
        after = self.insights.read_bytes()
        self.assertTrue(after.startswith(before))
        self.assertIn(b"Shared contracts have two checked-in copies", after)
        self.assertIn(b"<!-- insight-id:", after)

    def test_exact_duplicate_is_a_no_op(self) -> None:
        first = self.run_helper()
        self.assertEqual(first.returncode, 0, first.stderr)
        after_first = self.insights.read_bytes()

        second = self.run_helper()

        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(self.insights.read_bytes(), after_first)
        self.assertIn("SKIP duplicate", second.stdout)

    def test_missing_insights_file_is_not_created(self) -> None:
        self.insights.unlink()

        result = self.run_helper()

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.insights.exists())


if __name__ == "__main__":
    unittest.main()
