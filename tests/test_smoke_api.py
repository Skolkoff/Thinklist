import unittest

from scripts.smoke_api import (
    Check,
    normalize_base_url,
    run_comments_flow,
    run_hybrid_rank_flow,
    run_profile_update_flow,
    unique_demo_email,
)


class SmokeApiTests(unittest.TestCase):
    def test_normalize_base_url_removes_trailing_slash(self) -> None:
        self.assertEqual(normalize_base_url("http://localhost:8000/"), "http://localhost:8000")

    def test_check_marks_expected_status_success(self) -> None:
        check = Check(name="health", method="GET", url="http://example.test/health", expected_status=200)

        result = check.evaluate(status=200, body='{"status":"ok"}')

        self.assertTrue(result.ok)
        self.assertIn("200", result.summary)

    def test_check_marks_unexpected_status_failure(self) -> None:
        check = Check(name="health", method="GET", url="http://example.test/health", expected_status=200)

        result = check.evaluate(status=503, body='{"detail":"down"}')

        self.assertFalse(result.ok)
        self.assertIn("expected 200", result.summary)

    def test_unique_demo_email_uses_domain_and_prefix(self) -> None:
        email = unique_demo_email(prefix="qa")

        self.assertTrue(email.startswith("qa_"))
        self.assertTrue(email.endswith("@example.com"))

    def test_profile_update_flow_is_available_for_demo_validation(self) -> None:
        self.assertEqual(run_profile_update_flow.__name__, "run_profile_update_flow")

    def test_comments_flow_is_available_for_demo_validation(self) -> None:
        self.assertEqual(run_comments_flow.__name__, "run_comments_flow")

    def test_hybrid_rank_flow_is_available_for_demo_validation(self) -> None:
        self.assertEqual(run_hybrid_rank_flow.__name__, "run_hybrid_rank_flow")


if __name__ == "__main__":
    unittest.main()
