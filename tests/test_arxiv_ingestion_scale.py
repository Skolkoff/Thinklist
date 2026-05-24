import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArxivIngestionScaleTests(unittest.TestCase):
    def test_ingestion_defaults_are_incremental_and_safe(self):
        source = (
            REPO_ROOT / "backend-api" / "app" / "services" / "ingestion_arxiv.py"
        ).read_text(encoding="utf-8")

        self.assertIn("DEFAULT_ARXIV_TARGET_TOTAL = 5000", source)
        self.assertIn("DEFAULT_ARXIV_BATCH_SIZE = 100", source)
        self.assertIn("DEFAULT_ARXIV_INTERVAL_SECONDS = 300", source)
        self.assertIn("count_arxiv_papers", source)
        self.assertIn("run_arxiv_ingestion_batch", source)
        self.assertIn("target_reached", source)
        self.assertIn("create_or_get_paper", source)

    def test_existing_database_migration_expands_arxiv_source_config(self):
        migration = (
            REPO_ROOT
            / "backend-api"
            / "alembic"
            / "versions"
            / "0008_arxiv_ingestion_scheduler_config.py"
        ).read_text(encoding="utf-8")

        self.assertIn('"target_total": 5000', migration)
        self.assertIn('"batch_size": 100', migration)
        self.assertIn('"interval_seconds": 300', migration)
        self.assertIn('"cs.AI"', migration)
        self.assertIn('"econ.EM"', migration)
        self.assertIn('"eess.SP"', migration)
        self.assertIn('"astro-ph.GA"', migration)
        self.assertIn('"quant-ph"', migration)
        self.assertIn("UPDATE sources", migration)


if __name__ == "__main__":
    unittest.main()
