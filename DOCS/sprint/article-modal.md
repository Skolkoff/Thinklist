# Article Modal

Date: 2026-05-07

## Data Contract

Article modal renders article data returned by the backend article/feed/search APIs:

* title
* abstract
* source
* published year
* authors
* topics/tags
* DOI or URL
* generated image URL
* like count

Authors in the current data model are paper metadata, not user profiles. They should not be routed to a mocked user profile.

## Decision

Author chips in the Article modal now search by author name. This keeps the interaction useful without pretending that every paper author has a Thinklist user account.

## Removed Fallback

The previous production path used fake profile id `u3` when an author did not match the current user. That fallback is removed.

## Verification

* `npm run build`
* `python3 scripts/smoke_api.py --include-rebuild`
* Static search confirms `u3` is no longer present in active frontend code.
* Playwright: first feed article modal opened, author chips rendered from backend article metadata, and clicking an author searched by name.
* Screenshot: `output/playwright/search-author-flow.png`
