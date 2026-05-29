# Tag Localization And Incremental Feed Loading

Date: 2026-05-24

## Goal

Keep the growing arXiv corpus usable by translating scientific tags and loading articles incrementally instead of rendering thousands of cards at once.

## Performance Baseline

- `/feed?limit=20`: about 42 KB and 10 ms locally.
- `/feed?limit=100`: about 195 KB and 16 ms locally.
- `/feed?limit=500`: about 983 KB and 41 ms locally.
- `/feed?limit=5000`: about 1.81 MB and 80 ms locally at 943 articles.
- Five concurrent `/feed?limit=5000` requests took about 370-406 ms per request.

The backend is acceptable locally; the frontend was the pressure point because it parsed and rendered the whole loaded corpus.

## Decision

- Use `ARTICLE_PAGE_SIZE = 60` on the frontend.
- Use backend `next_cursor` for `/feed` and `/search`.
- Use `IntersectionObserver` to load the next page before the user reaches the bottom.
- Keep a conservative render budget in the feed so the DOM does not grow without bound.
- Add full masonry virtualization only if browser QA still shows jank near the 5000-article target.

## Tag Localization

Current arXiv tags now have exact ru/en labels where they appear in the loaded corpus. Future tags degrade through prefix labels for mathematics, physics, quantitative biology, quantitative finance, statistics, economics, EESS, astrophysics, condensed matter, high-energy physics, nonlinear sciences, and nuclear physics.

## Verification

```bash
python3 -m unittest \
  tests.test_tag_localization_contract \
  tests.test_frontend_incremental_feed_contract \
  tests.test_frontend_i18n \
  tests.test_article_sample_limit

cd frontend && npm run build
python3 scripts/smoke_api.py --include-hybrid-rank
```
