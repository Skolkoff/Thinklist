import unittest

from tests.ml_service_import import import_ml_module


domains = import_ml_module("app.services.domains")


class RecommendationDomainTests(unittest.TestCase):
    def test_maps_arxiv_tags_to_domains(self) -> None:
        self.assertEqual(domains.domain_for_tag("cs.LG"), "computer_science")
        self.assertEqual(domains.domain_for_tag("q-bio.QM"), "biology")
        self.assertEqual(domains.domain_for_tag("physics.data-an"), "physics")
        self.assertEqual(domains.domain_for_tag("math.OC"), "mathematics")
        self.assertEqual(domains.domain_for_tag("stat.ML"), "statistics")

    def test_collects_domains_from_tags(self) -> None:
        self.assertEqual(
            domains.domains_for_tags(["cs.LG", "q-bio.QM", "cs.AI"]),
            {"computer_science", "biology"},
        )

    def test_adjacent_domain_requires_difference_and_similarity(self) -> None:
        self.assertFalse(
            domains.is_adjacent_domain(
                user_domains={"computer_science"},
                candidate_domains={"computer_science"},
                semantic_similarity=0.9,
            )
        )
        self.assertTrue(
            domains.is_adjacent_domain(
                user_domains={"computer_science"},
                candidate_domains={"biology"},
                semantic_similarity=0.62,
            )
        )
        self.assertFalse(
            domains.is_adjacent_domain(
                user_domains={"computer_science"},
                candidate_domains={"biology"},
                semantic_similarity=0.12,
            )
        )


if __name__ == "__main__":
    unittest.main()
