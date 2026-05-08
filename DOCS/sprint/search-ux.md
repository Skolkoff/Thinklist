# Search UX

Date: 2026-05-07

## Decision

The navbar search is global. When a user types a query with at least two non-space characters, the app returns to the Feed view and displays API-backed search results there.

This avoids the previous confusing behavior where the same global search box could appear to filter the current Profile or Collections screen.

## Current Behavior

* Search input state remains global in `App.tsx`.
* Search queries with fewer than two characters do not trigger `/search`; the feed path remains active.
* Search queries with at least two characters call `/search?q=...`.
* Searching from Profile or Collections moves the user to Feed.
* Clicking an author in Article modal searches by author name instead of trying to open a fake author profile.

## API Notes

Frontend search uses:

```text
GET /search?q=<query>&tags=<csv>&limit=100
```

Tag-only filtering still uses `/search` when one or more tags are selected.

## Verification

* `npm run build`
* `python3 scripts/smoke_api.py --include-rebuild`
* Static search confirms active `u3` author fallback is removed.
* Playwright: opened first article, clicked first author, modal closed and global search input became `Changle Qu` on Feed.
* Screenshot: `output/playwright/search-author-flow.png`
