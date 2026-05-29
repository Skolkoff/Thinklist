import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "frontend" / "i18n.ts"


class TagLocalizationContractTest(unittest.TestCase):
    def test_known_arxiv_tags_have_human_labels(self) -> None:
        source = I18N.read_text(encoding="utf-8")
        expected = {
            "econ.GN": ("General Economics", "Общая экономика"),
            "eess.AS": ("Audio and Speech Processing", "Обработка аудио и речи"),
            "eess.SP": ("Signal Processing", "Обработка сигналов"),
            "math.AC": ("Commutative Algebra", "Коммутативная алгебра"),
            "math.CO": ("Combinatorics", "Комбинаторика"),
            "physics.optics": ("Optics", "Оптика"),
            "q-bio.QM": ("Quantitative Methods", "Количественные методы"),
            "q-fin.ST": ("Statistical Finance", "Статистические финансы"),
            "quant-ph": ("Quantum Physics", "Квантовая физика"),
            "stat.AP": ("Applications", "Прикладная статистика"),
        }

        for tag, labels in expected.items():
            self.assertIn(f"'{tag}'", source)
            for label in labels:
                self.assertIn(label, source)

    def test_legacy_seed_tags_are_humanized(self) -> None:
        source = I18N.read_text(encoding="utf-8")
        self.assertIn("'machine learning'", source)
        self.assertIn("'computer vision'", source)
        self.assertIn("Машинное обучение", source)
        self.assertIn("Компьютерное зрение", source)

    def test_prefix_fallbacks_exist_for_new_scientific_areas(self) -> None:
        source = I18N.read_text(encoding="utf-8")
        expected_prefixes = [
            "math.",
            "physics.",
            "q-bio.",
            "q-fin.",
            "stat.",
            "econ.",
            "eess.",
            "astro-ph.",
            "cond-mat.",
            "hep-",
            "nlin.",
            "nucl-",
        ]
        for prefix in expected_prefixes:
            self.assertIn(prefix, source)

        self.assertRegex(source, r"const\s+topicPrefixLabels")
        self.assertRegex(source, r"export\s+const\s+getTopicLabel")
        self.assertRegex(source, r"export\s+const\s+getTopicChipLabel")

    def test_no_current_backend_tags_fall_back_to_raw_codes_only(self) -> None:
        source = I18N.read_text(encoding="utf-8")
        current_tags = [
            "computer vision", "cond-mat.dis-nn", "cond-mat.mtrl-sci",
            "cond-mat.soft", "cond-mat.str-el", "cs.AI", "cs.AR", "cs.CC",
            "cs.CE", "cs.CG", "cs.CL", "cs.CR", "cs.CV", "cs.CY", "cs.DB",
            "cs.DC", "cs.DL", "cs.DM", "cs.DS", "cs.ET", "cs.FL", "cs.GR",
            "cs.GT", "cs.HC", "cs.IR", "cs.IT", "cs.LG", "cs.LO", "cs.MA",
            "cs.MM", "cs.MS", "cs.NE", "cs.NI", "cs.OS", "cs.PF", "cs.PL",
            "cs.RO", "cs.SC", "cs.SD", "cs.SE", "cs.SI", "econ.GN",
            "eess.AS", "eess.IV", "eess.SP", "eess.SY", "hep-th",
            "machine learning", "math.AC", "math.AG", "math.AT", "math.CO",
            "math.CT", "math.FA", "math.HO", "math.LO", "math.MG", "math.NA",
            "math.NT", "math.OC", "math.PR", "math.RA", "math.RT", "math.ST",
            "physics.ao-ph", "physics.app-ph", "physics.chem-ph",
            "physics.comp-ph", "physics.data-an", "physics.ed-ph",
            "physics.flu-dyn", "physics.geo-ph", "physics.med-ph",
            "physics.optics", "physics.plasm-ph", "physics.soc-ph",
            "q-bio.BM", "q-bio.QM", "q-fin.CP", "q-fin.MF", "q-fin.RM",
            "q-fin.ST", "q-fin.TR", "quant-ph", "stat.AP", "stat.CO",
            "stat.ML",
        ]
        explicit_tags = set(re.findall(r"^\s*'([^']+)'\s*:\s*\{ en:", source, re.MULTILINE))

        for tag in current_tags:
            has_explicit_label = tag in explicit_tags
            has_prefix_fallback = any(
                tag.startswith(prefix)
                for prefix in [
                    "cs.", "math.", "physics.", "q-bio.", "q-fin.", "stat.",
                    "econ.", "eess.", "astro-ph.", "cond-mat.", "hep-",
                    "nlin.", "nucl-",
                ]
            )
            self.assertTrue(has_explicit_label or has_prefix_fallback, tag)


if __name__ == "__main__":
    unittest.main()
