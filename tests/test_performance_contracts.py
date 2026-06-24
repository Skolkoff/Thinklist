import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PerformanceContractsTest(unittest.TestCase):
    def test_alembic_adds_search_vector_index(self) -> None:
        versions_dir = ROOT / "backend-api" / "alembic" / "versions"
        migration_sources = "\n".join(
            path.read_text(encoding="utf-8")
            for path in sorted(versions_dir.glob("*.py"))
        )

        self.assertIn("idx_papers_search_vector", migration_sources)
        self.assertIn("to_tsvector", migration_sources)
        self.assertIn("USING gin", migration_sources)

    def test_collections_load_papers_only_when_items_requested(self) -> None:
        source = (ROOT / "backend-api" / "app" / "main.py").read_text(
            encoding="utf-8"
        )
        start = source.index("def list_collections(")
        end = source.index("@app.post(\"/collections\"", start)
        body = source[start:end]

        self.assertIn("if include_items:", body)
        self.assertIn("selectinload(Collection.items).selectinload(CollectionItem.paper)", body)
        self.assertLess(
            body.index("if include_items:"),
            body.index("selectinload(Collection.items).selectinload(CollectionItem.paper)"),
        )

    def test_frontend_feed_does_not_merge_saved_articles_on_initial_load(self) -> None:
        source = (ROOT / "frontend" / "services" / "api.ts").read_text(
            encoding="utf-8"
        )
        start = source.index("fetchArticles:")
        end = source.index("getCollections:", start)
        body = source[start:end]

        self.assertNotIn("savedResponse", body)
        self.assertNotIn("/me/saved", body)

    def test_home_feed_counts_tags_from_visible_articles(self) -> None:
        source = (ROOT / "frontend" / "components" / "HomeFeed.tsx").read_text(
            encoding="utf-8"
        )
        start = source.index("const tagData = useMemo")
        end = source.index("return (", start)
        body = source[start:end]

        self.assertIn("visibleArticles.forEach", body)
        self.assertIn("visibleArticles.flatMap", body)
        self.assertNotIn("articles.forEach", body)


if __name__ == "__main__":
    unittest.main()
