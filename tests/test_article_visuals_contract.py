import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ArticleVisualsContractTest(unittest.TestCase):
    def test_frontend_uses_shared_editorial_cover_component(self) -> None:
        cover = ROOT / "frontend" / "components" / "ArticleCover.tsx"
        card_source = (ROOT / "frontend" / "components" / "ArticleCard.tsx").read_text(encoding="utf-8")
        modal_source = (ROOT / "frontend" / "components" / "ArticleModal.tsx").read_text(encoding="utf-8")

        self.assertTrue(cover.exists(), "ArticleCover.tsx should own article cover rendering")
        self.assertIn("ArticleCover", card_source)
        self.assertIn("ArticleCover", modal_source)
        self.assertNotRegex(card_source, r"<img\s+[^>]*article\.imageUrl")
        self.assertNotRegex(modal_source, r"<img\s+[^>]*article\.imageUrl")

    def test_visual_service_maps_major_scientific_domains(self) -> None:
        visuals = ROOT / "frontend" / "services" / "articleVisuals.ts"
        self.assertTrue(visuals.exists(), "articleVisuals.ts should provide deterministic cover metadata")
        source = visuals.read_text(encoding="utf-8")

        expected_domains = [
            "ai",
            "language",
            "vision",
            "security",
            "systems",
            "math",
            "physics",
            "biology",
            "finance",
            "economics",
            "statistics",
            "general",
        ]
        for domain in expected_domains:
            self.assertRegex(source, rf"['\"]{domain}['\"]", domain)

        expected_tags = [
            "cs.AI",
            "cs.LG",
            "cs.CL",
            "cs.CV",
            "cs.CR",
            "cs.DC",
            "math.",
            "physics.",
            "q-bio.",
            "q-fin.",
            "econ.",
            "stat.",
            "quant-ph",
        ]
        for tag in expected_tags:
            self.assertIn(tag, source)

        self.assertRegex(source, r"export\s+const\s+getArticleVisual")
        self.assertRegex(source, r"extractThesis")
        self.assertRegex(source, r"stableNumber")

    def test_picsum_fallback_is_removed_from_loaded_articles(self) -> None:
        api_source = (ROOT / "frontend" / "services" / "api.ts").read_text(encoding="utf-8")
        card_source = (ROOT / "frontend" / "components" / "ArticleCard.tsx").read_text(encoding="utf-8")
        modal_source = (ROOT / "frontend" / "components" / "ArticleModal.tsx").read_text(encoding="utf-8")

        self.assertNotIn("picsum.photos/seed/article", api_source)
        self.assertNotIn("picsum.photos", card_source)
        self.assertNotIn("picsum.photos", modal_source)

    def test_cover_component_is_lightweight_html_not_canvas_or_remote_images(self) -> None:
        cover = ROOT / "frontend" / "components" / "ArticleCover.tsx"
        self.assertTrue(cover.exists())
        source = cover.read_text(encoding="utf-8")

        self.assertNotIn("<canvas", source)
        self.assertNotRegex(source, r"<img\s")
        self.assertNotIn("fetch(", source)
        self.assertNotIn("http", source)
        self.assertRegex(source, r"mode\s*\?:\s*['\"]card['\"]\s*\|\s*['\"]modal['\"]\s*\|\s*['\"]compact['\"]")

    def test_cover_uses_article_excerpt_not_duplicate_title(self) -> None:
        source = (ROOT / "frontend" / "components" / "ArticleCover.tsx").read_text(encoding="utf-8")

        self.assertIn("visual.thesis", source)
        self.assertNotIn("titleText", source)
        self.assertNotIn("title.trim()", source)
        self.assertNotIn("<div>TL</div>", source)

    def test_cover_labels_are_localized(self) -> None:
        cover_source = (ROOT / "frontend" / "components" / "ArticleCover.tsx").read_text(encoding="utf-8")
        i18n_source = (ROOT / "frontend" / "i18n.ts").read_text(encoding="utf-8")

        self.assertIn("locale: Locale", cover_source)
        self.assertIn("t(locale, visual.labelKey)", cover_source)
        self.assertIn("t(locale, visual.kickerKey)", cover_source)
        self.assertIn("'cover.domain.ai'", i18n_source)
        self.assertIn("'cover.domain.math'", i18n_source)
        self.assertIn("'cover.kicker.general'", i18n_source)
        self.assertIn("Искусственный интеллект", i18n_source)
        self.assertIn("Научный брифинг", i18n_source)


if __name__ == "__main__":
    unittest.main()
