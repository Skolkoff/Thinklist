from pathlib import Path
import unittest

from tests.ml_service_import import import_ml_module


ROOT = Path(__file__).resolve().parents[1]


class NeuralArtifactContractTest(unittest.TestCase):
    def test_artifact_loader_module_and_expected_paths_exist(self) -> None:
        source_path = ROOT / "ml-service" / "app" / "services" / "neural_artifacts.py"
        self.assertTrue(source_path.exists())
        source = source_path.read_text(encoding="utf-8")

        self.assertIn("discovery_reranker_project_finetuned.pt", source)
        self.assertIn("cross_domain_boosted_reranker.pt", source)
        self.assertIn("NeuralArtifactBundle", source)
        self.assertIn("load_neural_artifacts", source)

    def test_rebuild_and_health_expose_artifact_status(self) -> None:
        main = (ROOT / "ml-service" / "app" / "main.py").read_text(encoding="utf-8")
        recommender = (
            ROOT / "ml-service" / "app" / "services" / "recommender.py"
        ).read_text(encoding="utf-8")

        self.assertIn("artifact_status", main)
        self.assertIn("get_artifact_status", main)
        self.assertIn("project_model_loaded", recommender)
        self.assertIn("cross_domain_model_loaded", recommender)

    def test_rank_response_contains_model_source(self) -> None:
        main = (ROOT / "ml-service" / "app" / "main.py").read_text(encoding="utf-8")
        recommender = (
            ROOT / "ml-service" / "app" / "services" / "recommender.py"
        ).read_text(encoding="utf-8")

        self.assertIn('"model": item.model', main)
        self.assertIn("project_finetuned", recommender)
        self.assertIn("cross_domain_boost", recommender)
        self.assertIn("hybrid_fallback", recommender)

    def test_missing_artifacts_keep_hybrid_fallback_usable(self) -> None:
        recommender = import_ml_module("app.services.recommender")
        rows = [
            {
                "id": 1,
                "title": "Neural language models",
                "abstract": "transformers and representation learning",
                "tags": ["cs.LG", "cs.CL"],
                "published_at": None,
            },
            {
                "id": 2,
                "title": "Graph neural networks",
                "abstract": "learning on graphs with neural networks",
                "tags": ["cs.LG"],
                "published_at": None,
            },
            {
                "id": 3,
                "title": "Biological signal analysis",
                "abstract": "neural signals and data analysis",
                "tags": ["q-bio.QM"],
                "published_at": None,
            },
        ]

        stats = recommender.rebuild_index(rows)
        ranked = recommender.rank_candidates_hybrid(
            positive_ids=[1],
            candidate_ids=[1, 2, 3],
            user_interests=["cs.LG"],
            hidden_ids=[],
            exploration_ratio=0.2,
        )

        self.assertFalse(stats["project_model_loaded"])
        self.assertFalse(stats["cross_domain_model_loaded"])
        self.assertIn("artifact_status", stats)
        self.assertTrue(ranked)
        self.assertTrue(all(item.model == "hybrid_fallback" for item in ranked))
        self.assertTrue(all("baseline" in item.scores for item in ranked))


if __name__ == "__main__":
    unittest.main()
