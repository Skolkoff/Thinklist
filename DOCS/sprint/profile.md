# Profile Flow

Date: 2026-05-07

Linear issue: TL-16 - Polish profile data, tabs, and edit flow for MVP demo

## Scope

- Keep the profile view tied to real API data.
- Do not show the global feed as user publications.
- Make profile editing wait for API success before closing.
- Show inline errors for profile save and password change failures.
- Keep profile screenshots and smoke checks as repeatable demo artifacts.

## Implementation Notes

- `frontend/App.tsx` now passes an empty `profileArticles` list to `ProfileView`.
- This is intentional until the backend has a real user-authored publication relation.
- `frontend/components/EditProfileModal.tsx` now awaits `onSave`, trims profile fields, disables actions while saving, and renders inline error state.
- Password changes now use inline success/error messaging instead of blocking alerts.
- `scripts/smoke_api.py` includes `--include-profile-update`, which creates a temporary user, updates `/me`, and reads the profile back.

## Artifacts

- `output/playwright/profile-ui-flow.png`
- `scripts/smoke_api.py --include-profile-update`
- `tests/test_smoke_api.py`

## Verification

- `npm run build`
- `python3 -m unittest tests.test_smoke_api tests.test_demo_data`
- `python3 scripts/smoke_api.py --include-profile-update`
- Playwright CLI flow:
  - authenticate a temporary user with `thinklist_token`
  - open own profile
  - confirm `Publications` shows `No publications yet.`
  - edit name, nickname, workplace, field, bio, and one interest
  - save and confirm updated values render in the profile header

## Open Follow-Up

- Add authored-publication support only when the backend has an explicit user-to-paper authoring model.
- Tailwind CDN warning remains open under the frontend build hygiene task.
