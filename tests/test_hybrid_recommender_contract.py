from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HybridRecommenderContractTests(unittest.TestCase):
    def test_ml_fetches_papers_with_tags_for_hybrid_ranking(self) -> None:
        source = (ROOT / "ml-service" / "app" / "db" / "session.py").read_text()

        self.assertIn("fetch_papers_with_tags", source)
        self.assertIn("paper_tags", source)
        self.assertIn("tags", source)

    def test_recommender_uses_lightweight_neural_reranker(self) -> None:
        requirements = (ROOT / "ml-service" / "requirements.txt").read_text()
        recommender = (ROOT / "ml-service" / "app" / "services" / "recommender.py").read_text()

        self.assertIn("scikit-learn", requirements)
        self.assertIn("MLPRegressor", recommender)
        self.assertIn("TruncatedSVD", recommender)
        self.assertIn("semantic_matrix", recommender)
        self.assertIn("semantic_similarity", recommender)
        self.assertIn("neural_reranker", recommender)

    def test_rank_response_contains_hybrid_scores_and_reasons(self) -> None:
        main = (ROOT / "ml-service" / "app" / "main.py").read_text()
        recommender = (ROOT / "ml-service" / "app" / "services" / "recommender.py").read_text()

        self.assertIn("user_interests", main)
        self.assertIn("exploration_ratio", main)
        self.assertIn("bucket", main)
        self.assertIn("reasons", main)
        self.assertIn("final_score", recommender)
        self.assertIn("tfidf_similarity", recommender)
        self.assertIn("interest_match", recommender)


if __name__ == "__main__":
    unittest.main()
