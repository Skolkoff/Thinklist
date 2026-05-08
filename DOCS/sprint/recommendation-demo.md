# Hybrid Neural Recommender Demo

Date: 2026-05-08

## Demo Goal

Show that SciVise recommendations combine:

- user interests
- liked/saved papers
- TF-IDF text similarity
- dense semantic similarity
- neural reranker score
- freshness
- cross-domain discovery
- explanation reasons

## Scenario

1. Start Docker services.
2. Ensure demo data exists.
3. Rebuild the ML index.
4. Register or use a local demo user.
5. Select interests such as `cs.LG`, `cs.AI`, `cs.CV`.
6. Like/save one or more articles.
7. Reload the feed.
8. Verify ranked results include score components and reasons.
9. If candidate data permits, verify adjacent-field recommendations.

## Commands

```bash
docker compose up -d --build
python3 scripts/demo_data.py
python3 scripts/smoke_api.py --include-rebuild --include-hybrid-rank
```

Full final smoke:

```bash
python3 scripts/smoke_api.py \
  --include-rebuild \
  --include-collection-crud \
  --include-profile-update \
  --include-comments \
  --include-hybrid-rank
```

## Expected ML Response Shape

```json
{
  "ranked": [
    {
      "paper_id": 1,
      "score": 0.78,
      "bucket": "core",
      "domain": "computer_science",
      "scores": {
        "semantic": 0.82,
        "tfidf": 0.71,
        "interest": 1.0,
        "behavior": 1.0,
        "freshness": 0.7,
        "diversity_penalty": 0.0
      },
      "reasons": [
        "Matches your selected interests",
        "Similar to saved papers"
      ]
    }
  ]
}
```

## Adjacent-Field Interpretation

An adjacent recommendation is a paper from a different scientific domain that remains semantically close to the user profile.

Example:

> Similar to saved papers on graph neural networks, but from computational biology.

## Final Evidence

- Unit/static tests: `21/21` passed.
- Frontend build: `npm run build` passed.
- Docker rebuild: `docker compose build` passed.
- Services: `backend-api` and `ml-service` healthy after `docker compose up -d`.
- API smoke: `12/12` passed with `--include-rebuild --include-collection-crud --include-profile-update --include-comments --include-hybrid-rank`.
- Hybrid rank evidence: response included `behavior,diversity_penalty,freshness,interest,neural,semantic,tfidf`.
- Browser console: `0 Errors, 0 Warnings`.
- Screenshot: `output/playwright/hybrid-recommender-feed.png`.
