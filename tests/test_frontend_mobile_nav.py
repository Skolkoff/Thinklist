from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class FrontendMobileNavTests(unittest.TestCase):
    def test_navbar_defines_mobile_bottom_navigation(self) -> None:
        source = (ROOT / "frontend" / "components" / "Navbar.tsx").read_text()

        self.assertIn("md:hidden", source)
        self.assertIn("aria-label=\"Mobile navigation\"", source)
        self.assertIn("MobileNavButton", source)

    def test_app_reserves_mobile_bottom_navigation_space(self) -> None:
        source = (ROOT / "frontend" / "App.tsx").read_text()

        self.assertIn("pb-24 md:pb-0", source)


if __name__ == "__main__":
    unittest.main()
