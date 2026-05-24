# arXiv Ingestion Scale

Date: 2026-05-24

## Goal

Accumulate at least 5000 unique arXiv papers for Thinklist/SciVise without overloading arXiv.

## Runtime Behavior

- Backend runs incremental arXiv ingestion in the background.
- Default interval: 300 seconds.
- Default batch size: 100.
- Target total: 5000 unique arXiv papers.
- Once target is reached, the worker reports `target_reached: true` and does not fetch more records.
- A manual batch can still be triggered with `POST /admin/ingestion/run`.

## Safety

- Requests use small batches.
- Retry delays handle transient `429` and `5xx` responses.
- Paper uniqueness is enforced through existing `create_or_get_paper` behavior and database constraints.
- The scheduler interval cannot be configured below 60 seconds.
- The scheduler batch size cannot be configured above 200 through environment settings.

## Coverage

The category list covers Computer Science, Economics, EESS, Mathematics, Astrophysics, Condensed Matter, General Relativity, High Energy Physics, Mathematical Physics, Nonlinear Sciences, Nuclear Physics, Physics, Quantum Physics, Quantitative Biology, Quantitative Finance, and Statistics.

## Status Check

```bash
curl http://localhost:8000/admin/ingestion/status
```

Expected shape:

```json
{
  "current_total": 100,
  "target_total": 5000,
  "target_reached": false,
  "scheduler_enabled": true,
  "scheduler_running": true,
  "next_run_at": "2026-05-24T12:00:00+00:00"
}
```

`current_total` grows over background/manual batches. It may stay below 5000 during early development runs because the requirement is accumulation over time, not one large import.

## Verification

```bash
python3 -m unittest \
  tests.test_arxiv_ingestion_scale \
  tests.test_arxiv_taxonomy_coverage \
  tests.test_arxiv_scheduler_contract \
  tests.test_demo_data \
  tests.test_smoke_api
```

Database uniqueness check:

```bash
docker compose exec -T postgres psql -U scivise -d scivise_db -c "
select
  count(*) as papers,
  count(distinct external_id) as unique_external_ids,
  count(distinct content_hash) as unique_content_hashes
from papers;
"
```
