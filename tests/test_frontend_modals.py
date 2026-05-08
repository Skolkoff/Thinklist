from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class FrontendModalTests(unittest.TestCase):
    def test_article_modal_has_dialog_accessibility_and_escape_close(self) -> None:
        source = (ROOT / "frontend" / "components" / "ArticleModal.tsx").read_text()

        self.assertIn('role="dialog"', source)
        self.assertIn('aria-modal="true"', source)
        self.assertIn("keydown", source)
        self.assertIn("Escape", source)
        self.assertIn("closeButtonRef", source)

    def test_board_modals_have_dialog_accessibility_and_escape_close(self) -> None:
        for filename in ["SaveBoardModal.tsx", "EditCollectionModal.tsx", "EditProfileModal.tsx"]:
            source = (ROOT / "frontend" / "components" / filename).read_text()

            self.assertIn('role="dialog"', source, filename)
            self.assertIn('aria-modal="true"', source, filename)
            self.assertIn("keydown", source, filename)
            self.assertIn("Escape", source, filename)


if __name__ == "__main__":
    unittest.main()
