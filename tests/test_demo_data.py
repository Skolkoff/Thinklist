import unittest

from scripts.demo_data import DEFAULT_MIN_PAPERS, DEFAULT_MIN_TAGS, should_run_ingestion


class DemoDataTests(unittest.TestCase):
    def test_default_minimums_match_final_ingestion_target(self) -> None:
        self.assertEqual(DEFAULT_MIN_PAPERS, 5000)
        self.assertEqual(DEFAULT_MIN_TAGS, 80)

    def test_should_run_ingestion_when_counts_are_below_minimums(self) -> None:
        self.assertTrue(should_run_ingestion(papers=10, tags=3, min_papers=50, min_tags=10))

    def test_should_not_run_ingestion_when_counts_meet_minimums(self) -> None:
        self.assertFalse(should_run_ingestion(papers=100, tags=27, min_papers=50, min_tags=10))


if __name__ == "__main__":
    unittest.main()
