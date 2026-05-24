import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArxivSchedulerContractTests(unittest.TestCase):
    def test_backend_exposes_scheduler_lifecycle_and_status(self):
        source = (REPO_ROOT / "backend-api" / "app" / "main.py").read_text(
            encoding="utf-8"
        )

        self.assertIn("start_arxiv_ingestion_scheduler", source)
        self.assertIn("stop_arxiv_ingestion_scheduler", source)
        self.assertIn("arxiv_scheduler_running", source)
        self.assertIn('"target_total"', source)
        self.assertIn('"current_total"', source)
        self.assertIn('"next_run_at"', source)

    def test_settings_define_safe_scheduler_defaults(self):
        source = (
            REPO_ROOT / "backend-api" / "app" / "core" / "config.py"
        ).read_text(encoding="utf-8")

        self.assertIn("arxiv_ingestion_enabled", source)
        self.assertIn("arxiv_ingestion_interval_seconds", source)
        self.assertIn("arxiv_ingestion_batch_size", source)
        self.assertIn("arxiv_ingestion_target_total", source)


if __name__ == "__main__":
    unittest.main()
