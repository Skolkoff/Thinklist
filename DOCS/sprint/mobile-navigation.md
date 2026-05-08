# Mobile Navigation

Date: 2026-05-08

Linear issue: TL-21 - Add complete mobile navigation for MVP surfaces

## Scope

- Add mobile navigation for the MVP surfaces that remain in scope.
- Keep removed social/chat features out of navigation.
- Preserve desktop navigation behavior.
- Prevent fixed mobile controls from covering feed content.

## Implementation Notes

- `frontend/components/Navbar.tsx` now renders a `md:hidden` fixed bottom navigation.
- Mobile navigation includes:
  - Home
  - Boards
  - Profile for authenticated users
  - Sign in for guests
- Messenger, friends, blocking, and chat actions are not present.
- The top mobile search bar uses a shorter placeholder to avoid cramped text.
- `frontend/App.tsx` now gives `main` a `pb-24 md:pb-0` bottom offset so article cards are not hidden behind the fixed navigation.

## Artifacts

- `output/playwright/mobile-nav-guest.png`
- `tests/test_frontend_mobile_nav.py`

## Verification

- `python3 -m unittest tests.test_frontend_mobile_nav tests.test_smoke_api tests.test_demo_data`
- `npm run build`
- `python3 scripts/smoke_api.py --include-rebuild --include-collection-crud --include-profile-update`
- `docker compose up -d --build frontend`
- `curl http://localhost:5740/` returns 200
- Playwright CLI mobile viewport `390x844`:
  - mobile navigation text is `Home`, `Boards`, `Sign in`
  - `main` bottom padding is `96px`
  - tapping `Boards` opens the collections surface
  - console after storage clear has 0 errors and 0 warnings
- Playwright CLI desktop viewport `1280x900`:
  - mobile navigation computes `display: none`
  - desktop links remain visible

## Notes

- A stale localStorage token in the browser produced one expected `/api/me` 401 during testing. Clearing localStorage removed it and the clean guest reload had no console errors.
