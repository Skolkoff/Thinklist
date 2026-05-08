# ML Demo Readiness

Date: 2026-05-07

## Root Cause

`/ml/rank` returned `503 model_not_ready` because the TF-IDF index is kept only in memory and was not rebuilt on ML service startup. The index existed only after a manual `POST /ml/rebuild`.

## Fix

`ml-service/app/main.py` now rebuilds the index from the database during FastAPI startup. `/ml/rank` also performs a self-healing rebuild if the in-memory index is unexpectedly empty.

If ranking still cannot initialize, the error response points to the recovery action:

```json
{
  "detail": {
    "code": "model_not_ready",
    "rebuild": "POST /ml/rebuild"
  }
}
```

## Sample Checks

Health:

```bash
curl http://localhost:8001/health
```

Expected:

```json
{"status":"ok","db":"ok"}
```

Rank:

```bash
curl -X POST http://localhost:8001/ml/rank \
  -H 'Content-Type: application/json' \
  -d '{"user_id":1,"positive_paper_ids":[1],"candidate_paper_ids":[1,2,3,4,5]}'
```

Expected shape:

```json
{
  "ranked": [
    {"paper_id": 1, "score": 0.9999999999999998}
  ]
}
```

Manual rebuild:

```bash
curl -X POST http://localhost:8001/ml/rebuild
```

Expected local result on the current seed:

```json
{"status":"ok","limit":null,"documents":100,"vocab_size":3586}
```

## Verification Evidence

Commands run:

* `python3 -m py_compile ml-service/app/main.py ml-service/app/services/recommender.py`
* `docker compose up -d --build ml-service`
* `curl http://localhost:8001/health`
* `curl -X POST http://localhost:8001/ml/rank ...`
* `curl -X POST http://localhost:8001/ml/rebuild`

Observed startup log:

```text
ml_index_rebuilt documents=100 vocab_size=3586 limit=None
```

Observed rank response status: `200`.

Backend smoke:

* `GET http://localhost:8000/health` returned `{"status":"ok"}`.
* `GET http://localhost:8000/feed?limit=5` returned `200`.
* Backend logs since the fix did not show `ml_rank_failed`.
