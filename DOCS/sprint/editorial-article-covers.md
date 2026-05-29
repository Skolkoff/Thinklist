# Editorial Article Covers

Date: 2026-05-24

## Goal

Replace random remote article thumbnails with deterministic editorial covers that are generated in the browser from article metadata.

## Runtime Behavior

- Cards and article modals render `ArticleCover` instead of `<img src={article.imageUrl}>`.
- Covers use local HTML/CSS only: no canvas, no image generation API, no storage, no remote image fetch.
- `articleVisuals.ts` maps arXiv tags to scientific visual domains and chooses a stable palette/pattern from article id, title, and tags.
- Each cover includes a compact thesis extracted from the abstract, plus domain, source, year, and top tags.
- Missing `imageUrl` values now stay empty on the frontend instead of falling back to `picsum`.

## Domain Coverage

The first visual taxonomy covers AI, language/NLP, computer vision, security, systems, mathematics, physics, biology, finance, economics, statistics, and a general fallback.

## Cost Profile

The feature adds no backend CPU work, no generated image files, and no third-party media requests. The only runtime cost is normal React rendering and CSS painting in the client.

## Verification

```bash
python3 -m unittest tests.test_article_visuals_contract
cd frontend && npm run build
```

Full regression set:

```bash
python3 -m unittest \
  tests.test_article_visuals_contract \
  tests.test_frontend_mobile_nav \
  tests.test_frontend_modals \
  tests.test_frontend_i18n
```
