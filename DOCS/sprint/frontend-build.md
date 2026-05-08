# Frontend Build Hygiene

Date: 2026-05-07

Linear issue: TL-20 - Move Tailwind from CDN to production Vite/PostCSS setup

## Scope

- Remove Tailwind CDN from production HTML.
- Build Tailwind CSS through the Vite pipeline.
- Keep the existing custom theme tokens and utility classes.
- Verify browser console is clean after the container rebuild.

## Implementation Notes

- Added `frontend/tailwind.config.js` with the existing theme extension:
  - `primary`
  - `secondary`
  - `scigray`
  - `muted`
  - `dark.bg`
  - `dark.card`
  - `dark.border`
- Added `frontend/postcss.config.js`.
- Added `frontend/styles.css` with Tailwind layers and the previous base/custom scrollbar styles.
- Imported `styles.css` from `frontend/index.tsx`.
- Removed `https://cdn.tailwindcss.com` and inline `tailwind.config` from `frontend/index.html`.

## Artifacts

- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- `frontend/styles.css`
- `output/playwright/tailwind-postcss.png`

## Verification

- `npm run build`
- `docker compose up -d --build frontend`
- Browser console after reload: 0 errors, 0 warnings
- DOM check: no `script[src*="cdn.tailwindcss.com"]`
- `npm audit --omit=dev`: 0 vulnerabilities

## Notes

- The first Docker rebuild after adding Tailwind dependencies took around 2 minutes because the image had to install the new package set.
- A future Dockerfile cleanup can switch to copying `package-lock.json` and using `npm ci` for more reproducible and cache-friendly installs.
