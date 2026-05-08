# Demo Data Workflow

Date: 2026-05-07

## Command

Prepare data and rebuild the ML index:

```bash
python3 scripts/demo_data.py
```

The script:

* checks the current public feed count through `GET /feed`;
* checks available tags through `GET /tags`;
* runs `POST /admin/ingestion/run` only when the dataset is below configured minimums;
* runs `POST /ml/rebuild`;
* exits non-zero if the dataset is still too small after preparation.

## Defaults

* Minimum papers visible through feed: `50`
* Minimum tags: `10`
* Backend URL: `http://localhost:8000`
* ML URL: `http://localhost:8001`

Override example:

```bash
python3 scripts/demo_data.py --min-papers 100 --min-tags 20
```

## Current Local Inventory

Latest run:

```text
Before: papers_at_least=50/50, tags=27/10
Ingestion skipped: current data meets demo minimums.
Rebuilding ML index...
ML rebuild: {"status": "ok", "limit": null, "documents": 100, "vocab_size": 3586}
After: papers_at_least=50/50, tags=27/10
```

## Demo Accounts

No fixed shared demo credentials are committed. Use the normal registration/onboarding flow for a local demo account, then run authenticated smoke checks with the issued bearer token when needed:

```bash
python3 scripts/smoke_api.py --token "$THINKLIST_TOKEN"
```

## Files

* Demo data orchestration: `scripts/demo_data.py`
* Smoke checks: `scripts/smoke_api.py`
* Unit tests: `tests/test_demo_data.py`, `tests/test_smoke_api.py`
