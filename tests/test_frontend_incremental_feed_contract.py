import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FrontendIncrementalFeedContractTest(unittest.TestCase):
    def test_frontend_uses_small_article_pages(self) -> None:
        source = (ROOT / "frontend" / "services" / "api.ts").read_text(encoding="utf-8")

        self.assertIn("ARTICLE_PAGE_SIZE = 60", source)
        self.assertNotIn("ARTICLE_FETCH_LIMIT = 5000", source)
        self.assertIn("next_cursor", source)
        self.assertIn("nextCursor", source)

    def test_app_tracks_incremental_loading_state(self) -> None:
        source = (ROOT / "frontend" / "App.tsx").read_text(encoding="utf-8")

        self.assertIn("nextCursor", source)
        self.assertIn("loadingMore", source)
        self.assertIn("hasMore", source)
        self.assertIn("loadMoreArticles", source)
        self.assertIn("append", source)

    def test_home_feed_has_load_more_sentinel(self) -> None:
        source = (ROOT / "frontend" / "components" / "HomeFeed.tsx").read_text(encoding="utf-8")

        self.assertIn("onLoadMore", source)
        self.assertIn("IntersectionObserver", source)
        self.assertIn("loadingMore", source)
        self.assertIn("hasMore", source)
        self.assertIn("RENDERED_ARTICLE_LIMIT", source)
        self.assertIn("visibleArticles", source)

    def test_search_endpoint_supports_cursor(self) -> None:
        source = (ROOT / "backend-api" / "app" / "main.py").read_text(encoding="utf-8")

        self.assertRegex(source, r"def search\(")
        self.assertIn("cursor: str | None = None", source)
        self.assertIn("next_cursor", source)
