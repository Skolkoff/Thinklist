# T8.4 Verification Log

Date: 2026-01-14

## Environment
- Services: postgres, backend-api, ml-service (docker compose)
- Backend: http://localhost:8000
- ML service: http://localhost:8001

## Steps
1) Rebuild TF-IDF index:
   ```bash
   curl -sS -X POST "http://localhost:8001/ml/rebuild"
   ```
   Response:
   ```json
   {"status":"ok","limit":null,"documents":100,"vocab_size":3673,"built_at":"2026-01-14T13:40:31.515570Z"}
   ```

2) Rank candidates (using latest feed ids):
   Payload:
   ```json
   {
     "user_id": 1,
     "positive_paper_ids": [1, 2],
     "candidate_paper_ids": [1, 2, 3, 4, 5, 6]
   }
   ```
   Response:
   ```json
   {
     "ranked": [
       {"paper_id": 2, "score": 0.7144082780790463},
       {"paper_id": 1, "score": 0.7144082780790456},
       {"paper_id": 6, "score": 0.08980058679257853},
       {"paper_id": 4, "score": 0.06750146441589698},
       {"paper_id": 3, "score": 0.044866390937565434},
       {"paper_id": 5, "score": 0.026258053549056443}
     ]
   }
   ```
