# Backend And ML Smoke Checks

Date: 2026-05-07

## Command

Run public backend and ML checks:

```bash
python3 scripts/smoke_api.py
```

Run public checks and rebuild the in-memory ML index:

```bash
python3 scripts/smoke_api.py --include-rebuild
```

Run optional authenticated checks if you have a bearer token:

```bash
python3 scripts/smoke_api.py --token "$THINKLIST_TOKEN"
```

## Current Public Coverage

The smoke runner checks:

* `GET /health`
* `GET /tags`
* `GET /feed?limit=5`
* `GET /search?q=learning&limit=5`
* `GET /papers/1`
* `GET /health` on ML service
* `POST /ml/rank`
* Optional `POST /ml/rebuild`

With `--token`, it also checks:

* `GET /me`
* `GET /collections?include_items=1`
* `GET /me/saved`

## Latest Local Result

Command:

```bash
python3 scripts/smoke_api.py --include-rebuild
```

Result:

```text
[PASS] backend health: GET http://localhost:8000/health -> 200
[PASS] tags: GET http://localhost:8000/tags -> 200
[PASS] feed: GET http://localhost:8000/feed?limit=5 -> 200
[PASS] search: GET http://localhost:8000/search?q=learning&limit=5 -> 200
[PASS] paper detail: GET http://localhost:8000/papers/1 -> 200
[PASS] ml health: GET http://localhost:8001/health -> 200
[PASS] ml rank: POST http://localhost:8001/ml/rank -> 200
[PASS] ml rebuild: POST http://localhost:8001/ml/rebuild -> 200

All 8 smoke checks passed.
```

## Files

* Smoke runner: `scripts/smoke_api.py`
* Unit tests: `tests/test_smoke_api.py`
