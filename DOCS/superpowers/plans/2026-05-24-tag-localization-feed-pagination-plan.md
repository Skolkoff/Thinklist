# Tag Localization And Incremental Feed Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all scientific tags human-readable in Russian/English and stop the frontend from loading/rendering thousands of articles at once.

**Architecture:** Keep backend cursor pagination as the source of truth. The frontend should request small pages, append results with `next_cursor`, and render a controlled number of article cards instead of requesting `limit=5000`. Tag localization stays client-side through the existing `i18n.ts` topic label helpers, with explicit arXiv labels and prefix-based fallbacks.

**Tech Stack:** FastAPI, SQLAlchemy, React, TypeScript, Vite, Tailwind, Python unittest, Playwright/browser QA.

---

## Current Evidence

- `/tags`: 87 tags, 953 bytes, about 28 ms locally.
- `/feed?limit=20`: 20 items, 42 KB, about 10 ms locally.
- `/feed?limit=100`: 100 items, 195 KB, about 16 ms locally.
- `/feed?limit=500`: 500 items, 983 KB, about 41 ms locally.
- `/feed?limit=5000`: currently 943 items, 1.81 MB, about 80 ms locally.
- Five concurrent `/feed?limit=5000` requests took about 370-406 ms per request.
- Main bottleneck is frontend work: JSON parse, React state, hundreds/thousands of `ArticleCard` and `ArticleCover` nodes, and CSS `columns` layout recalculation.

---

## File Structure

- Modify `frontend/i18n.ts`
  - Add exact labels for the arXiv categories now used by ingestion.
  - Add prefix fallback labels for unseen `math.*`, `physics.*`, `q-bio.*`, `q-fin.*`, `stat.*`, `econ.*`, `eess.*`, `astro-ph.*`, `cond-mat.*`, `hep-*`, `nlin.*`, `nucl-*`.
  - Keep `getTopicLabel` and `getTopicChipLabel` as the only public helpers for tag display.
- Modify `frontend/services/api.ts`
  - Replace `ARTICLE_FETCH_LIMIT = 5000` with small page size constants.
  - Return `{ items, nextCursor }` for feed/search instead of only `Article[]`.
  - Preserve existing auth and normalization behavior.
- Modify `frontend/App.tsx`
  - Track pagination state: `articles`, `nextCursor`, `loading`, `loadingMore`, `hasMore`.
  - Reset pagination when filters/search/view dependencies change.
  - Add `loadMoreArticles` callback.
- Modify `frontend/components/HomeFeed.tsx`
  - Accept pagination props and render a sentinel/load-more affordance.
  - Keep tag weighting based on currently loaded articles.
- Modify `frontend/components/CollectionsFeed.tsx`
  - Avoid requesting/rendering all feed articles for collection suggestions if not needed in this phase.
  - Keep behavior stable; no new recommendation architecture in this step.
- Modify `frontend/components/RegisterStepInterests.tsx`
  - Use `getTopicChipLabel` for onboarding tags.
- Modify `frontend/components/ArticleCover.tsx`
  - Use `getTopicChipLabel` or `getTopicLabel` for footer tags instead of raw tag codes.
- Modify `frontend/components/ArticleModal.tsx`
  - Ensure modal tags use translated labels through `Tag`.
- Modify `backend-api/app/main.py`
  - Add cursor pagination to `/search`, matching `/feed` response shape.
  - Keep `ARTICLE_FETCH_LIMIT_MAX = 5000` as backend safety ceiling, but frontend should not use it as a default.
- Create `tests/test_tag_localization_contract.py`
  - Static contract for full taxonomy label coverage and fallback behavior.
- Create `tests/test_frontend_incremental_feed_contract.py`
  - Static contract proving the frontend does not request `limit=5000`, consumes `next_cursor`, and has load-more/sentinel state.
- Modify `tests/test_article_sample_limit.py`
  - Update frontend expectation from `ARTICLE_FETCH_LIMIT = 5000` to a small page size while preserving backend max limit tests.
- Create `DOCS/sprint/tag-localization-feed-pagination.md`
  - Document the performance evidence, chosen page size, and remaining virtualization threshold.
- Modify `DOCS/BACKEND_TASKS.md`
  - Add “Этап 14. Tag localization and incremental feed loading”.

---

## Task 1: Tag Localization Contract

**Files:**
- Create: `tests/test_tag_localization_contract.py`
- Modify later: `frontend/i18n.ts`

- [ ] **Step 1: Write the failing localization coverage test**

Create `tests/test_tag_localization_contract.py`:

```python
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "frontend" / "i18n.ts"


class TagLocalizationContractTest(unittest.TestCase):
    def test_known_arxiv_tags_have_human_labels(self) -> None:
        source = I18N.read_text(encoding="utf-8")
        expected = {
            "econ.GN": ("General Economics", "Общая экономика"),
            "eess.AS": ("Audio and Speech Processing", "Обработка аудио и речи"),
            "eess.SP": ("Signal Processing", "Обработка сигналов"),
            "math.AC": ("Commutative Algebra", "Коммутативная алгебра"),
            "math.CO": ("Combinatorics", "Комбинаторика"),
            "physics.optics": ("Optics", "Оптика"),
            "q-bio.QM": ("Quantitative Methods", "Количественные методы"),
            "q-fin.ST": ("Statistical Finance", "Статистические финансы"),
            "quant-ph": ("Quantum Physics", "Квантовая физика"),
            "stat.AP": ("Applications", "Прикладная статистика"),
        }

        for tag, labels in expected.items():
            self.assertIn(f"'{tag}'", source)
            for label in labels:
                self.assertIn(label, source)

    def test_legacy_seed_tags_are_humanized(self) -> None:
        source = I18N.read_text(encoding="utf-8")
        self.assertIn("'machine learning'", source)
        self.assertIn("'computer vision'", source)
        self.assertIn("Машинное обучение", source)
        self.assertIn("Компьютерное зрение", source)

    def test_prefix_fallbacks_exist_for_new_scientific_areas(self) -> None:
        source = I18N.read_text(encoding="utf-8")
        expected_prefixes = [
            "math.",
            "physics.",
            "q-bio.",
            "q-fin.",
            "stat.",
            "econ.",
            "eess.",
            "astro-ph.",
            "cond-mat.",
            "hep-",
            "nlin.",
            "nucl-",
        ]
        for prefix in expected_prefixes:
            self.assertIn(prefix, source)

        self.assertRegex(source, r"const\\s+topicPrefixLabels")
        self.assertRegex(source, r"export\\s+const\\s+getTopicLabel")
        self.assertRegex(source, r"export\\s+const\\s+getTopicChipLabel")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 -m unittest tests.test_tag_localization_contract
```

Expected: FAIL because `topicPrefixLabels` and many exact labels do not exist yet.

---

## Task 2: Implement Tag Localization

**Files:**
- Modify: `frontend/i18n.ts`
- Modify: `frontend/components/RegisterStepInterests.tsx`
- Modify: `frontend/components/ArticleCover.tsx`
- Verify: `frontend/components/ArticleModal.tsx`

- [ ] **Step 1: Add exact labels and prefix fallbacks**

In `frontend/i18n.ts`, extend `topicLabels` with exact entries for all currently returned tags that are missing. Use this pattern:

```ts
const topicLabels: Record<string, TopicLabel> = {
  'machine learning': { en: 'Machine Learning', ru: 'Машинное обучение', shortRu: 'ML' },
  'computer vision': { en: 'Computer Vision', ru: 'Компьютерное зрение', shortRu: 'CV' },
  'econ.GN': { en: 'General Economics', ru: 'Общая экономика', shortRu: 'Экономика' },
  'eess.AS': { en: 'Audio and Speech Processing', ru: 'Обработка аудио и речи', shortRu: 'Аудио' },
  'eess.IV': { en: 'Image and Video Processing', ru: 'Обработка изображений и видео', shortRu: 'Видео' },
  'eess.SP': { en: 'Signal Processing', ru: 'Обработка сигналов', shortRu: 'Сигналы' },
  'eess.SY': { en: 'Systems and Control', ru: 'Системы и управление', shortRu: 'Системы' },
  'math.AC': { en: 'Commutative Algebra', ru: 'Коммутативная алгебра', shortRu: 'Алгебра' },
  'math.AG': { en: 'Algebraic Geometry', ru: 'Алгебраическая геометрия', shortRu: 'Алг. геометрия' },
  'math.AT': { en: 'Algebraic Topology', ru: 'Алгебраическая топология', shortRu: 'Топология' },
  'math.CO': { en: 'Combinatorics', ru: 'Комбинаторика', shortRu: 'Комбинаторика' },
  'math.CT': { en: 'Category Theory', ru: 'Теория категорий', shortRu: 'Категории' },
  'math.FA': { en: 'Functional Analysis', ru: 'Функциональный анализ', shortRu: 'Функц. анализ' },
  'math.HO': { en: 'History and Overview', ru: 'История и обзор математики', shortRu: 'История' },
  'math.LO': { en: 'Logic', ru: 'Математическая логика', shortRu: 'Логика' },
  'math.MG': { en: 'Metric Geometry', ru: 'Метрическая геометрия', shortRu: 'Метрика' },
  'math.NT': { en: 'Number Theory', ru: 'Теория чисел', shortRu: 'Теория чисел' },
  'math.PR': { en: 'Probability', ru: 'Теория вероятностей', shortRu: 'Вероятность' },
  'math.RA': { en: 'Rings and Algebras', ru: 'Кольца и алгебры', shortRu: 'Кольца' },
  'math.RT': { en: 'Representation Theory', ru: 'Теория представлений', shortRu: 'Представления' },
  'math.ST': { en: 'Statistics Theory', ru: 'Теория статистики', shortRu: 'Статистика' },
  'physics.optics': { en: 'Optics', ru: 'Оптика', shortRu: 'Оптика' },
  'q-bio.QM': { en: 'Quantitative Methods', ru: 'Количественные методы', shortRu: 'Био-методы' },
  'q-fin.ST': { en: 'Statistical Finance', ru: 'Статистические финансы', shortRu: 'Стат. финансы' },
  'quant-ph': { en: 'Quantum Physics', ru: 'Квантовая физика', shortRu: 'Квантовая' },
  'stat.AP': { en: 'Applications', ru: 'Прикладная статистика', shortRu: 'Прикладная' },
  'stat.CO': { en: 'Computation', ru: 'Вычислительная статистика', shortRu: 'Выч. стат.' },
  // keep existing labels and add the rest of the current API tags in this same explicit form
};
```

Add prefix fallback config below `topicLabels`:

```ts
const topicPrefixLabels: Array<{ prefix: string; en: string; ru: string }> = [
  { prefix: 'math.', en: 'Mathematics', ru: 'Математика' },
  { prefix: 'physics.', en: 'Physics', ru: 'Физика' },
  { prefix: 'q-bio.', en: 'Quantitative Biology', ru: 'Количественная биология' },
  { prefix: 'q-fin.', en: 'Quantitative Finance', ru: 'Количественные финансы' },
  { prefix: 'stat.', en: 'Statistics', ru: 'Статистика' },
  { prefix: 'econ.', en: 'Economics', ru: 'Экономика' },
  { prefix: 'eess.', en: 'Electrical Engineering and Systems Science', ru: 'Электроника и системные науки' },
  { prefix: 'astro-ph.', en: 'Astrophysics', ru: 'Астрофизика' },
  { prefix: 'cond-mat.', en: 'Condensed Matter', ru: 'Конденсированное состояние' },
  { prefix: 'hep-', en: 'High Energy Physics', ru: 'Физика высоких энергий' },
  { prefix: 'nlin.', en: 'Nonlinear Sciences', ru: 'Нелинейные науки' },
  { prefix: 'nucl-', en: 'Nuclear Physics', ru: 'Ядерная физика' },
];
```

Update `getTopicLabel` fallback:

```ts
export const getTopicLabel = (tag: string, locale: Locale): string => {
  const exact = topicLabels[tag]?.[locale] || topicLabels[tag]?.en;
  if (exact) return exact;

  const prefix = topicPrefixLabels.find(item => tag.startsWith(item.prefix));
  if (prefix) {
    const suffix = tag.slice(prefix.prefix.length).replaceAll('-', ' ').replaceAll('_', ' ').toUpperCase();
    return `${prefix[locale]}: ${suffix}`;
  }

  if (tag.startsWith('cs.')) {
    return locale === 'ru' ? `Информатика: ${tag.slice(3)}` : `Computer Science: ${tag.slice(3)}`;
  }

  return tag;
};
```

- [ ] **Step 2: Localize onboarding tags**

In `frontend/components/RegisterStepInterests.tsx`, import `getTopicChipLabel` and use:

```tsx
<Tag
  key={tag}
  label={getTopicChipLabel(tag, locale)}
  selected={selectedTags.includes(tag)}
  onClick={() => toggleTag(tag)}
/>
```

- [ ] **Step 3: Localize cover footer tags**

In `frontend/components/ArticleCover.tsx`, import `getTopicChipLabel` if not already imported and replace raw join:

```tsx
{(article.tags || []).slice(0, 3).map(tag => getTopicChipLabel(tag, locale)).join(' / ') || t(locale, 'cover.generalTag')}
```

- [ ] **Step 4: Run localization tests**

Run:

```bash
python3 -m unittest tests.test_tag_localization_contract tests.test_frontend_i18n
```

Expected: PASS.

---

## Task 3: API Pagination Contract

**Files:**
- Create: `tests/test_frontend_incremental_feed_contract.py`
- Modify later: `frontend/services/api.ts`
- Modify later: `backend-api/app/main.py`
- Modify later: `tests/test_article_sample_limit.py`

- [ ] **Step 1: Write frontend pagination contract test**

Create `tests/test_frontend_incremental_feed_contract.py`:

```python
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FrontendIncrementalFeedContractTest(unittest.TestCase):
    def test_frontend_uses_small_article_pages(self) -> None:
        source = (ROOT / "frontend" / "services" / "api.ts").read_text(encoding="utf-8")

        self.assertIn("ARTICLE_PAGE_SIZE = 60", source)
        self.assertNotIn("ARTICLE_FETCH_LIMIT = 5000", source)
        self.assertIn("next_cursor", source)
        self.assertIn("nextCursor", source)

    def test_app_tracks_incremental_loading_state(self) -> None:
        source = (ROOT / "frontend" / "App.tsx").read_text(encoding="utf-8")

        self.assertIn("nextCursor", source)
        self.assertIn("loadingMore", source)
        self.assertIn("hasMore", source)
        self.assertIn("loadMoreArticles", source)
        self.assertIn("append", source)

    def test_home_feed_has_load_more_sentinel(self) -> None:
        source = (ROOT / "frontend" / "components" / "HomeFeed.tsx").read_text(encoding="utf-8")

        self.assertIn("onLoadMore", source)
        self.assertIn("IntersectionObserver", source)
        self.assertIn("loadingMore", source)
        self.assertIn("hasMore", source)

    def test_search_endpoint_supports_cursor(self) -> None:
        source = (ROOT / "backend-api" / "app" / "main.py").read_text(encoding="utf-8")

        self.assertRegex(source, r"def search\\(")
        self.assertIn("cursor: str | None = None", source)
        self.assertIn("next_cursor", source)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 -m unittest tests.test_frontend_incremental_feed_contract
```

Expected: FAIL because the frontend still fetches `5000` and `HomeFeed` has no sentinel.

---

## Task 4: Backend Search Cursor Pagination

**Files:**
- Modify: `backend-api/app/main.py`
- Test: `tests/test_frontend_incremental_feed_contract.py`

- [ ] **Step 1: Add cursor support to `/search`**

In `backend-api/app/main.py`, update the `search` signature:

```python
def search(
    request: Request,
    q: str | None = Query(None, min_length=2),
    limit: int = Query(20, ge=1, le=ARTICLE_FETCH_LIMIT_MAX),
    cursor: str | None = None,
    tags: list[str] | None = Query(None),
    source: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
```

Before fetching papers, apply cursor when there is no full-text rank ordering:

```python
if cursor and rank is None:
    cursor_ts, cursor_id = _parse_cursor(cursor)
    query = query.filter(
        or_(
            Paper.published_at < cursor_ts,
            and_(Paper.published_at == cursor_ts, Paper.id < cursor_id),
        )
    )
```

For ranked search, use stable offset cursor:

```python
offset = 0
if cursor and rank is not None:
    offset = _parse_ml_cursor(cursor)
```

When ordering and limiting:

```python
if rank is not None:
    papers = query.order_by(rank.desc(), Paper.published_at.desc(), Paper.id.desc()).offset(offset).limit(limit + 1).all()
    items = papers[:limit]
    next_cursor = f"ml:{offset + len(items)}" if len(papers) > limit else None
else:
    papers = query.order_by(Paper.published_at.desc(), Paper.id.desc()).limit(limit + 1).all()
    items = papers[:limit]
    next_cursor = None
    if len(papers) > limit and items:
        last = items[-1]
        next_cursor = f"{last.published_at.isoformat()}|{last.id}"
```

Return:

```python
return {
    "items": [_paper_to_article(paper, like_map) for paper in items],
    "next_cursor": next_cursor,
}
```

- [ ] **Step 2: Verify backend/static contract**

Run:

```bash
python3 -m unittest tests.test_frontend_incremental_feed_contract
```

Expected: still FAIL until frontend work is implemented, but search cursor assertions should pass.

---

## Task 5: Frontend API Incremental Loading

**Files:**
- Modify: `frontend/services/api.ts`
- Modify: `tests/test_article_sample_limit.py`

- [ ] **Step 1: Replace bulk fetch with page response**

In `frontend/services/api.ts`, replace the limit constant:

```ts
const ARTICLE_PAGE_SIZE = 60;
```

Add response types near `normalizeArticle`:

```ts
interface ArticleListResponse {
  items: Article[];
  next_cursor?: string | null;
}

export interface ArticlePage {
  items: Article[];
  nextCursor: string | null;
}
```

Change `fetchArticles` signature:

```ts
fetchArticles: async (filters: FilterState, cursor?: string | null): Promise<ArticlePage> => {
```

Use `limit: ARTICLE_PAGE_SIZE` and include `cursor`:

```ts
const response = await request<ArticleListResponse>(`/feed${query}`);
return {
  items: response.items.map(normalizeArticle),
  nextCursor: response.next_cursor || null,
};
```

For search/tag filtering, call `/search` with the same page size and cursor:

```ts
const response = await request<ArticleListResponse>(`/search${query}`);
return {
  items: response.items.map(normalizeArticle),
  nextCursor: response.next_cursor || null,
};
```

Keep saved article merge only for the first unfiltered page:

```ts
if (!cursor && hasAuth) {
  const savedResponse = await request<{ items: Article[] }>('/me/saved');
  const merged = new Map<string, Article>();
  response.items.forEach(item => merged.set(item.id, item));
  savedResponse.items.forEach(item => merged.set(item.id, item));
  return {
    items: Array.from(merged.values()).map(normalizeArticle),
    nextCursor: response.next_cursor || null,
  };
}
```

- [ ] **Step 2: Update old sample limit test**

In `tests/test_article_sample_limit.py`, preserve backend max assertions and change frontend assertion to:

```python
self.assertIn("ARTICLE_PAGE_SIZE = 60", source)
self.assertNotIn("ARTICLE_FETCH_LIMIT = 5000", source)
```

- [ ] **Step 3: Run API contract tests**

Run:

```bash
python3 -m unittest tests.test_frontend_incremental_feed_contract tests.test_article_sample_limit
```

Expected: frontend API parts pass; App/HomeFeed parts still fail until next task.

---

## Task 6: App Pagination State And Load More

**Files:**
- Modify: `frontend/App.tsx`
- Modify: `frontend/components/HomeFeed.tsx`

- [ ] **Step 1: Add pagination state in `App.tsx`**

Add state next to article state:

```tsx
const [nextCursor, setNextCursor] = useState<string | null>(null);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(false);
```

Update `fetchContent` to reset and load first page:

```tsx
const fetchContent = useCallback(async () => {
  setLoading(true);
  try {
    const page = await api.fetchArticles(filters);
    setArticles(page.items);
    setNextCursor(page.nextCursor);
    setHasMore(Boolean(page.nextCursor));

    if (currentUser) {
      const fetchedCollections = await api.getCollections(
        profileUserId && currentView === ViewState.PROFILE ? profileUserId : undefined
      );
      setCollections(fetchedCollections);
    } else {
      setCollections([]);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    setLoading(false);
  }
}, [filters, currentView, profileUserId, currentUser]);
```

Add load more callback:

```tsx
const loadMoreArticles = useCallback(async () => {
  if (!nextCursor || loadingMore || loading) return;
  setLoadingMore(true);
  try {
    const page = await api.fetchArticles(filters, nextCursor);
    setArticles(prev => {
      const merged = new Map(prev.map(article => [article.id, article]));
      page.items.forEach(article => merged.set(article.id, article));
      return Array.from(merged.values());
    });
    setNextCursor(page.nextCursor);
    setHasMore(Boolean(page.nextCursor));
  } catch (error) {
    console.error("Failed to load more articles", error);
  } finally {
    setLoadingMore(false);
  }
}, [filters, nextCursor, loadingMore, loading]);
```

Pass props to `HomeFeed`:

```tsx
loadingMore={loadingMore}
hasMore={hasMore}
onLoadMore={loadMoreArticles}
```

- [ ] **Step 2: Add sentinel in `HomeFeed.tsx`**

Update props:

```tsx
loadingMore?: boolean;
hasMore?: boolean;
onLoadMore?: () => void;
```

Import `useEffect` and `useRef`:

```tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
```

Create sentinel:

```tsx
const loadMoreRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  if (!hasMore || loadingMore || !onLoadMore) return;
  const node = loadMoreRef.current;
  if (!node) return;

  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      onLoadMore();
    }
  }, { rootMargin: '600px 0px' });

  observer.observe(node);
  return () => observer.disconnect();
}, [hasMore, loadingMore, onLoadMore]);
```

Render after `MasonryGrid`:

```tsx
{hasMore && (
  <div ref={loadMoreRef} className="flex justify-center py-8 text-sm text-gray-500">
    {loadingMore ? t(locale, 'feed.loadingMore') : t(locale, 'feed.loadMore')}
  </div>
)}
```

Add i18n keys:

```ts
'feed.loadingMore': 'Loading more articles...',
'feed.loadMore': 'Scroll for more articles',
```

Russian:

```ts
'feed.loadingMore': 'Загружаем еще статьи...',
'feed.loadMore': 'Прокрутите, чтобы загрузить еще',
```

- [ ] **Step 3: Run frontend pagination contract**

Run:

```bash
python3 -m unittest tests.test_frontend_incremental_feed_contract tests.test_frontend_i18n
```

Expected: PASS.

---

## Task 7: Render Budget Guard

**Files:**
- Modify: `frontend/components/HomeFeed.tsx`
- Modify: `tests/test_frontend_incremental_feed_contract.py`

- [ ] **Step 1: Add a conservative render cap for the first pass**

In `HomeFeed.tsx`, define:

```tsx
const RENDERED_ARTICLE_LIMIT = 240;
const visibleArticles = articles.slice(0, RENDERED_ARTICLE_LIMIT);
const hiddenLoadedCount = Math.max(0, articles.length - visibleArticles.length);
```

Render `visibleArticles` instead of `articles`:

```tsx
{visibleArticles.map(article => (
  <ArticleCard
    key={article.id}
    article={article}
    onOpen={onOpenArticle}
    onSave={onSaveArticle}
    locale={locale}
    canInteract={canInteract}
    onRequireAuth={onRequireAuth}
  />
))}
```

If `hiddenLoadedCount > 0`, render a small note:

```tsx
{hiddenLoadedCount > 0 && (
  <div className="text-center text-xs text-gray-500">
    {t(locale, 'feed.renderBudget', { count: hiddenLoadedCount })}
  </div>
)}
```

Add i18n:

```ts
'feed.renderBudget': '{{count}} loaded articles are waiting. Keep scrolling to keep the interface smooth.',
```

Russian:

```ts
'feed.renderBudget': 'Еще {{count}} загруженных статей ждут показа. Продолжайте прокрутку, чтобы интерфейс оставался плавным.',
```

- [ ] **Step 2: Extend contract test**

Add to `test_home_feed_has_load_more_sentinel`:

```python
self.assertIn("RENDERED_ARTICLE_LIMIT", source)
self.assertIn("visibleArticles", source)
```

- [ ] **Step 3: Run tests**

Run:

```bash
python3 -m unittest tests.test_frontend_incremental_feed_contract tests.test_frontend_i18n
```

Expected: PASS.

---

## Task 8: Documentation And Backlog

**Files:**
- Create: `DOCS/sprint/tag-localization-feed-pagination.md`
- Modify: `DOCS/BACKEND_TASKS.md`

- [ ] **Step 1: Add sprint doc**

Create `DOCS/sprint/tag-localization-feed-pagination.md`:

```markdown
# Tag Localization And Incremental Feed Loading

Date: 2026-05-24

## Goal

Keep the growing arXiv corpus usable by translating scientific tags and loading articles incrementally instead of rendering thousands of cards at once.

## Performance Baseline

- `/feed?limit=20`: about 42 KB and 10 ms locally.
- `/feed?limit=100`: about 195 KB and 16 ms locally.
- `/feed?limit=500`: about 983 KB and 41 ms locally.
- `/feed?limit=5000`: about 1.81 MB and 80 ms locally at 943 articles.

The backend is acceptable locally; the frontend was the pressure point because it parsed and rendered the whole loaded corpus.

## Decision

- Use `ARTICLE_PAGE_SIZE = 60` on the frontend.
- Use backend `next_cursor` for `/feed` and `/search`.
- Use `IntersectionObserver` to load the next page before the user reaches the bottom.
- Keep the first implementation simple; add full virtualization only if browser QA still shows jank near 5000 articles.

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
```

- [ ] **Step 2: Add backend task stage**

In `DOCS/BACKEND_TASKS.md`, add:

```markdown
## Этап 14. Tag localization and incremental feed loading

- [ ] T14.1 Перевести расширенный taxonomy тегов на ru/en
- [ ] T14.2 Добавить fallback labels для новых arXiv prefixes
- [ ] T14.3 Перевести теги во всех UI surfaces
- [ ] T14.4 Перевести frontend feed/search на cursor pagination
- [ ] T14.5 Добавить плавную дозагрузку через IntersectionObserver
- [ ] T14.6 Зафиксировать render budget и performance evidence

**DoD:** фронт не запрашивает и не рендерит 5000 статей сразу, а все научные теги читаемы на русском и английском.
```

---

## Task 9: Final Verification

**Files:**
- Verify full implementation.

- [ ] **Step 1: Run static/unit tests**

Run:

```bash
python3 -m unittest \
  tests.test_tag_localization_contract \
  tests.test_frontend_incremental_feed_contract \
  tests.test_frontend_i18n \
  tests.test_frontend_modals \
  tests.test_article_visuals_contract \
  tests.test_article_sample_limit
```

Expected: PASS.

- [ ] **Step 2: Build frontend**

Run:

```bash
cd frontend && npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 3: Run API smoke**

Run:

```bash
python3 scripts/smoke_api.py --include-hybrid-rank
```

Expected: all smoke checks pass.

- [ ] **Step 4: Browser QA**

Run/rebuild:

```bash
docker compose up -d --build frontend backend-api
```

Open `http://localhost:5740` and verify:

- Initial feed request uses `limit=60`, not `limit=5000`.
- Scrolling triggers additional feed/search requests with `cursor`.
- Tag chips are human-readable in Russian.
- Switching language to English changes tag labels and cover labels.
- The page remains responsive while scrolling through several pages.
- Article modal still opens, shows translated tags, and comments still load.

---

## Self-Review

- Spec coverage: The plan covers tag translation, tag fallback behavior, frontend page size reduction, backend search cursor support, smooth load-more, render budget, docs, and verification.
- Placeholder scan: No open-ended implementation placeholders are intentionally left. Each task names files, code shapes, commands, and expected outcomes.
- Type consistency: The plan consistently uses `ArticlePage`, `items`, `nextCursor`, backend `next_cursor`, `loadingMore`, `hasMore`, and `onLoadMore`.
