# Modal Responsiveness And Accessibility

Date: 2026-05-08

Linear issue: TL-22 - Fix modal responsiveness, clipping, and accessibility focus behavior

## Scope

- Improve mobile modal sizing and clipping.
- Add basic dialog accessibility semantics.
- Support Escape-to-close.
- Put initial focus on a close action where practical.
- Keep modal behavior compatible with the current MVP surfaces.

## Implementation Notes

- `ArticleModal` now has:
  - `role="dialog"`
  - `aria-modal="true"`
  - `aria-labelledby="article-modal-title"`
  - Escape-to-close listener
  - initial focus on the mobile close button
  - mobile height `h-[calc(100dvh-1rem)]`
  - shorter mobile hero image height
  - fixed mobile share menu positioning so it is not clipped by the modal container
- `SaveBoardModal`, `EditCollectionModal`, and `EditProfileModal` now have:
  - `role="dialog"`
  - `aria-modal="true"`
  - labelled title
  - Escape-to-close listener
  - close button labels
- Added static regression tests for modal accessibility and Escape support.

## Artifacts

- `tests/test_frontend_modals.py`
- `output/playwright/modal-mobile-share.png`

## Verification

- `python3 -m unittest tests.test_frontend_modals tests.test_frontend_mobile_nav tests.test_smoke_api tests.test_demo_data`
- `npm run build`
- `python3 scripts/smoke_api.py --include-rebuild --include-collection-crud --include-profile-update`
- `docker compose up -d --build frontend`
- Playwright CLI mobile viewport `390x844`:
  - article modal opens with `role="dialog"` and `aria-modal="true"`
  - modal height is within the viewport
  - focus starts on `Close article`
  - share menu renders over the modal
  - Escape closes the modal

## Notes

- A transient Docker Hub TLS timeout occurred during the first container rebuild attempt; rerunning the build completed successfully.
