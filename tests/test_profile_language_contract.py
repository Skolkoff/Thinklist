import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ProfileLanguageContractTest(unittest.TestCase):
    def test_backend_profile_persists_language_preference(self):
        main_source = (REPO_ROOT / "backend-api" / "app" / "main.py").read_text(encoding="utf-8")
        model_source = (REPO_ROOT / "backend-api" / "app" / "models" / "user.py").read_text(encoding="utf-8")
        migration_source = (
            REPO_ROOT / "backend-api" / "alembic" / "versions" / "0006_user_language_preference.py"
        ).read_text(encoding="utf-8")

        self.assertIn("language_preference", model_source)
        self.assertIn("languagePreference", main_source)
        self.assertIn("language_preference", main_source)
        self.assertIn("language_preference", migration_source)

    def test_frontend_profile_can_override_system_language(self):
        app_source = (REPO_ROOT / "frontend" / "App.tsx").read_text(encoding="utf-8")
        modal_source = (REPO_ROOT / "frontend" / "components" / "EditProfileModal.tsx").read_text(encoding="utf-8")
        api_source = (REPO_ROOT / "frontend" / "services" / "api.ts").read_text(encoding="utf-8")
        i18n_source = (REPO_ROOT / "frontend" / "i18n.ts").read_text(encoding="utf-8")

        self.assertIn("resolveLocale", i18n_source)
        self.assertIn("languagePreference", app_source)
        self.assertIn("onLanguagePreferenceChange", modal_source)
        self.assertIn("language_preference", api_source)


if __name__ == "__main__":
    unittest.main()
