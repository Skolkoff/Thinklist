import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
I18N_FILE = REPO_ROOT / "frontend" / "i18n.ts"


class FrontendI18nContractTest(unittest.TestCase):
    def test_topic_labels_keep_raw_arxiv_values_human_readable(self):
        source = I18N_FILE.read_text(encoding="utf-8")

        expected_labels = {
            "cs.LG": ("Machine Learning", "Машинное обучение"),
            "cs.AI": ("Artificial Intelligence", "Искусственный интеллект"),
            "cs.CL": ("Computational Linguistics", "Компьютерная лингвистика"),
            "stat.ML": ("Machine Learning (Statistics)", "Машинное обучение (статистика)"),
        }

        for raw_tag, labels in expected_labels.items():
            self.assertIn(raw_tag, source)
            for label in labels:
                self.assertIn(label, source)

        self.assertRegex(source, r"export\s+const\s+getTopicLabel")
        self.assertRegex(source, r"export\s+const\s+getTopicChipLabel")

    def test_ru_topic_chips_use_short_labels_for_mobile_feed(self):
        source = I18N_FILE.read_text(encoding="utf-8")

        expected_short_labels = {
            "cs.AI": "ИИ",
            "cs.CL": "NLP",
            "cs.LG": "ML",
            "cs.CV": "CV",
        }

        for raw_tag, short_label in expected_short_labels.items():
            pattern = rf"'{re.escape(raw_tag)}'.*?shortRu:\s*'{re.escape(short_label)}'"
            self.assertRegex(source, pattern)

    def test_locale_detection_uses_browser_language_with_ru_fallback(self):
        source = I18N_FILE.read_text(encoding="utf-8")

        self.assertRegex(source, r"navigator\.languages")
        self.assertRegex(source, r"startsWith\('ru'\)")
        self.assertRegex(source, r"export\s+const\s+detectLocale")

    def test_home_feed_topics_bar_has_safe_sticky_layout(self):
        source = (REPO_ROOT / "frontend" / "components" / "HomeFeed.tsx").read_text(encoding="utf-8")

        self.assertIn("top-[73px]", source)
        self.assertIn("max-h-[150px]", source)
        self.assertIn("pt-0.5", source)
        self.assertIn("shrink-0", source)


if __name__ == "__main__":
    unittest.main()
