# Sprint QA Audit - 2026-05-07

## Purpose

First sprint knowledge-base entry for finishing Thinklist / SciVise. This document records a real browser smoke test, API fingerprints, screenshots, and the defects found during the pass.

## Environment

- Date: 2026-05-07
- App URL: http://localhost:5740/
- Backend API: http://localhost:8000
- ML service: http://localhost:8001
- Runner: Docker Compose
- Browser automation: Playwright CLI wrapper at `~/.codex/skills/playwright/scripts/playwright_cli.sh`
- Viewports checked:
  - Desktop default Playwright viewport
  - Mobile `390x844`

## Service Health

All containers were running.

```text
scivise-backend-api   healthy   0.0.0.0:8000->8000
scivise-ml-service    healthy   0.0.0.0:8001->8001
scivise-postgres      healthy   0.0.0.0:5432->5432
thinklist-frontend    running   0.0.0.0:5740->80
```

HTTP checks:

```text
GET http://localhost:8000/health -> 200 {"status":"ok"}
GET http://localhost:8000/version -> 200 {"version":"0.1.0"}
GET http://localhost:8001/health -> 200 {"status":"ok","db":"ok"}
GET http://localhost:5740/ -> 200
```

Database fingerprint after QA run:

```text
users: 1
papers: 100
tags: 27

QA user:
id=1
email=qa_1778146677@example.com
nickname=qa1778146690
collections=1
events=1
```

## Scenarios Tested

| Scenario | Result | Notes |
| --- | --- | --- |
| Guest home feed loads | Pass | Feed and tags loaded from real API. |
| Registration step 1 | Pass | Email, password, nickname accepted. |
| Avatar onboarding | Pass | Preset avatar saved through `/me`. |
| Interests onboarding | Pass | `cs.AI`, `cs.CL` saved through `/me`. |
| Bio onboarding | Pass | Bio saved and user returned to app. |
| Authenticated feed | Pass with warning | Feed loads; ML rerank fails server-side because model is not built. |
| Save article to new board | Pass with UI issue | Collection and collection item created. |
| Collections page | Pass | Created board appears and saved article is visible. |
| Profile page | Pass | Bio, interests, board count render. |
| Edit profile modal | Pass with responsive caveat | Modal opens; mobile layout is usable but tall/internal scroll is heavy. |
| Search | Pass | `/api/search?q=reasoning&limit=100` returned results. |
| Mobile viewport | Partial | Feed is readable, but main nav links are hidden on mobile. |

## Findings

### P1 - ML recommendations are not ready after service start

Evidence:

```text
POST http://localhost:8001/ml/rank -> 503 {"detail":"model_not_ready"}
backend log: ml_rank_failed user_id=1 error=Server error '503 Service Unavailable' for url 'http://ml-service:8001/ml/rank'
```

Impact: after the user saves/likes an article, `/feed` attempts ML reranking, fails, and silently falls back. The app still works, but the core diploma feature "personal recommendations" is not active after a normal `docker compose up`.

Likely source:

- `ml-service/app/services/recommender.py:69` raises `model_not_ready` when the in-memory index is empty.

Recommended fix:

- Add startup/demo orchestration for `POST /ml/rebuild` after migrations and ingestion.
- Consider persisting the model/index or rebuilding it automatically on ML service startup.
- Add an admin/demo script that proves `/ml/rank` returns 200 before a presentation.

### P1 - Messenger exists in code but is unreachable in the app shell

Evidence:

- `frontend/components/MessengerModal.tsx` is implemented.
- `frontend/services/api.ts` exposes `getChats`, `getFriends`, `sendMessage`, `startChat`, reactions, clear/delete/block.
- `frontend/App.tsx` does not import or render `MessengerModal`.
- `frontend/components/Navbar.tsx` has no messages button.

Impact: README promises messenger/social exchange, backend has chat endpoints, but users cannot open messages from the UI.

Recommended fix:

- Add a messages button to the authenticated navbar.
- Mount `MessengerModal` in `App.tsx`.
- Smoke test empty state, friends list, start chat, send message, reaction, delete/clear.

### P2 - Mobile navigation hides Home and Collections without replacement

Evidence:

- `frontend/components/Navbar.tsx:34` uses `hidden md:flex` for navigation links.
- Mobile screenshot `output/playwright/14-mobile-feed.png` shows logo, search, profile only.

Impact: on mobile, users cannot directly reach Collections from the nav. They can reach profile through avatar, but collections navigation is not discoverable.

Recommended fix:

- Add a mobile bottom nav, menu button, or compact icon buttons for Home/Collections/Messages/Profile.

### P2 - Production build uses Tailwind CDN

Evidence:

Browser console warning:

```text
cdn.tailwindcss.com should not be used in production.
```

Source:

- `frontend/index.html:7` loads `https://cdn.tailwindcss.com`.

Impact: production styling depends on external CDN runtime, slower startup, and not production-grade. This also weakens offline/demo reliability.

Recommended fix:

- Move Tailwind to PostCSS/Vite pipeline.
- Move custom Tailwind config from inline HTML into `tailwind.config.*`.

### P2 - Missing favicon creates a 404 and nginx error

Evidence:

```text
GET /favicon.ico -> 404
nginx error: open() "/usr/share/nginx/html/favicon.ico" failed
```

Impact: low functional risk, but it adds noise to QA and production logs.

Recommended fix:

- Add `frontend/public/favicon.ico` or point to an existing SVG icon in `index.html`.

### P2 - Save-board modal clips visibility controls

Evidence:

- Screenshot: `output/playwright/08-create-board.png`
- The "Private" visibility option is truncated to "Pri" at the right edge.

Impact: the user cannot clearly see all visibility options when creating a board.

Recommended fix:

- Let visibility controls wrap, reduce labels, or use a select/segmented control with responsive overflow handling.

### P3 - Search state is global and affects profile content

Evidence:

- Search for `reasoning` from profile filtered the profile publication grid instead of clearly navigating to a search results/feed context.
- Screenshot: `output/playwright/12-search.png`

Impact: behavior is technically functional but confusing: the navbar search feels global, while results appear inside the current view.

Recommended fix:

- Decide product behavior:
  - Global search navigates to feed/search view.
  - Or profile search should be labeled/scoped to the profile.

### P3 - Modal accessibility snapshots are incomplete

Evidence:

- Playwright screenshots show `SaveBoardModal` and `EditProfileModal`.
- `playwright-cli snapshot` often continued to expose the underlying page tree rather than the active dialog contents.

Impact: keyboard/screen-reader QA may be unreliable. This also made test automation harder.

Recommended fix:

- Add dialog semantics: `role="dialog"`, `aria-modal="true"`, accessible title, focus trap, and deterministic close behavior.

## Positive Notes

- Docker startup is healthy.
- Backend migrations ran on container startup.
- Real arXiv-derived data is present.
- Registration, login, JWT auth, profile update, interests, collections, saved item, and search all worked through the UI.
- Backend endpoints returned successful responses for the main MVP flows.
- The app is visually usable on desktop, and mobile feed rendering is not blank or broken.

## Artifacts

Screenshots:

```text
output/playwright/01-home.png
output/playwright/02-register-step1.png
output/playwright/03-register-avatar.png
output/playwright/04-register-interests.png
output/playwright/05-register-bio.png
output/playwright/06-auth-home.png
output/playwright/07-article-modal.png
output/playwright/08-create-board.png
output/playwright/09-collections.png
output/playwright/10-profile.png
output/playwright/11-edit-profile.png
output/playwright/12-search.png
output/playwright/13-mobile-home.png
output/playwright/14-mobile-feed.png
```

Playwright session artifacts:

```text
.playwright-cli/page-*.yml
.playwright-cli/console-*.log
```

Important console output:

```text
[WARNING] cdn.tailwindcss.com should not be used in production.
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ /favicon.ico
```

Important network/API output:

```text
GET /api/tags -> 200
GET /api/feed?limit=100 -> 200
GET /api/auth/nickname-available?nickname=qa1778146690 -> 200
POST /api/auth/register -> 201
POST /api/auth/login -> 200
GET /api/me -> 200
PUT /api/me -> 200
GET /api/me/saved -> 200
GET /api/collections?include_items=1 -> 200
POST /api/collections -> 201
POST /api/collections/1/items -> 201
GET /api/collections?user_id=1&include_items=1 -> 200
GET /api/users/1 -> 200
GET /api/search?q=reasoning&limit=100 -> 200
POST /ml/rank -> 503 model_not_ready
```

## Suggested Sprint Backlog

1. Make recommendations demo-ready:
   - run `/ml/rebuild` automatically or from a documented demo script;
   - verify `/ml/rank` returns 200;
   - add a visible "recommendations are personalized" QA scenario.
2. Wire messenger into the UI:
   - navbar entry;
   - modal mount;
   - empty state and start-chat flow.
3. Fix responsive navigation:
   - mobile access to Home, Collections, Messages, Profile.
4. Productionize frontend assets:
   - remove Tailwind CDN;
   - add favicon;
   - keep styling inside the Vite pipeline.
5. Polish dialogs:
   - save-board visibility controls;
   - dialog ARIA/focus behavior;
   - mobile edit-profile height/scroll.
6. Clarify search behavior:
   - global search route/view or scoped search labels.

## Re-run Checklist

```bash
docker compose up -d --build
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:8001/health
curl -fsS http://localhost:5740/

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" open http://localhost:5740 --headed
"$PWCLI" snapshot
"$PWCLI" console warning
"$PWCLI" requests
```

