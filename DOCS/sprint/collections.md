# Collections Flow

Date: 2026-05-07

## Current MVP Contract

Collections are authenticated user-owned boards for saving papers.

Active backend endpoints:

* `GET /collections?include_items=1`
* `POST /collections`
* `PUT /collections/{collection_id}`
* `DELETE /collections/{collection_id}`
* `POST /collections/{collection_id}/items`
* `DELETE /collections/{collection_id}/items/{paper_id}`

Active visibility values:

* `public`
* `followers`
* `private`

`friends` is no longer an active MVP visibility option.

## UX Decisions

* SaveBoard modal supports creating a board and saving the selected article in one flow.
* SaveBoard modal shows empty/no-match states for board search.
* SaveBoard modal has pending states for create/save actions to avoid duplicate clicks.
* Visibility controls are laid out as a fixed three-option grid to avoid clipping.
* Collections view exposes `All Articles`, `All Boards`, and individual board chips.
* Empty board states route users back to Feed.

## Verification

API:

```bash
python3 scripts/smoke_api.py --include-rebuild --include-collection-crud
```

Latest local result:

```text
[PASS] collection CRUD: created=3 -> added paper 1 -> updated -> listed with paper -> delete=200
All 9 smoke checks passed.
```

UI:

* Playwright CLI authenticated flow created `UI Smoke Board`.
* The first feed article was saved into that board.
* Collections view showed `UI Smoke Board` and the saved article.
* Screenshot: `output/playwright/collections-ui-flow.png`

Other checks:

* `npm run build`
* `python3 -m unittest tests.test_smoke_api tests.test_demo_data`
