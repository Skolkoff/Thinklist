import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArticleSampleLimitTest(unittest.TestCase):
    def test_frontend_requests_small_article_pages(self):
        source = (REPO_ROOT / "frontend" / "services" / "api.ts").read_text(encoding="utf-8")

        self.assertIn("ARTICLE_PAGE_SIZE = 60", source)
        self.assertNotIn("ARTICLE_FETCH_LIMIT = 5000", source)
        self.assertNotIn("limit: 100", source)

    def test_backend_allows_5000_article_feed_and_search_limits(self):
        source = (REPO_ROOT / "backend-api" / "app" / "main.py").read_text(encoding="utf-8")

        self.assertIn("ARTICLE_FETCH_LIMIT_MAX = 5000", source)
        self.assertIn("CANDIDATE_POOL_MAX = 5000", source)
        self.assertIn("CANDIDATE_POOL_DEFAULT = 5000", source)
        self.assertIn("limit: int = Query(20, ge=1, le=ARTICLE_FETCH_LIMIT_MAX)", source)


if __name__ == "__main__":
    unittest.main()
