import ast
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArxivTaxonomyCoverageTests(unittest.TestCase):
    def test_default_categories_cover_major_arxiv_domains(self):
        source = (
            REPO_ROOT / "backend-api" / "app" / "services" / "ingestion_arxiv.py"
        ).read_text(encoding="utf-8")
        tree = ast.parse(source)
        categories = []
        for node in tree.body:
            if isinstance(node, ast.Assign):
                names = [
                    target.id for target in node.targets if isinstance(target, ast.Name)
                ]
                if "DEFAULT_ARXIV_CATEGORIES" in names:
                    categories = ast.literal_eval(node.value)
                    break

        prefixes = {
            "cs.": "computer_science",
            "econ.": "economics",
            "eess.": "electrical_engineering_systems_science",
            "math.": "mathematics",
            "astro-ph.": "astrophysics",
            "cond-mat.": "condensed_matter",
            "gr-qc": "general_relativity",
            "hep-": "high_energy_physics",
            "math-ph": "mathematical_physics",
            "nlin.": "nonlinear_sciences",
            "nucl-": "nuclear",
            "physics.": "physics",
            "quant-ph": "quantum_physics",
            "q-bio.": "quantitative_biology",
            "q-fin.": "quantitative_finance",
            "stat.": "statistics",
        }

        missing = []
        for prefix, label in prefixes.items():
            if not any(
                category == prefix or category.startswith(prefix)
                for category in categories
            ):
                missing.append(label)

        self.assertEqual([], missing)
        self.assertGreaterEqual(len(categories), 120)


if __name__ == "__main__":
    unittest.main()
