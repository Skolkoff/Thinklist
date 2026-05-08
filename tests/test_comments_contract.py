from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CommentsContractTests(unittest.TestCase):
    def test_backend_exposes_article_comment_models_and_routes(self) -> None:
        models = (ROOT / "backend-api" / "app" / "models" / "user.py").read_text()
        main = (ROOT / "backend-api" / "app" / "main.py").read_text()

        self.assertIn("class ArticleComment", models)
        self.assertIn("class CommentReaction", models)
        self.assertIn("@app.get(\"/papers/{paper_id}/comments\")", main)
        self.assertIn("@app.post(\"/papers/{paper_id}/comments\"", main)
        self.assertIn("@app.post(\"/comments/{comment_id}/reactions\"", main)
        self.assertIn("@app.delete(\"/comments/{comment_id}/reactions/{emoji}\")", main)

    def test_frontend_article_modal_renders_comments_only_reactions(self) -> None:
        modal = (ROOT / "frontend" / "components" / "ArticleModal.tsx").read_text()
        api = (ROOT / "frontend" / "services" / "api.ts").read_text()

        self.assertIn("Comments", modal)
        self.assertIn("comment.reactionCounts", modal)
        self.assertIn("addArticleComment", api)
        self.assertIn("reactToComment", api)
        self.assertNotIn("message_reactions", modal)


if __name__ == "__main__":
    unittest.main()
