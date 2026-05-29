# Editorial Article Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace random external article images with lightweight deterministic editorial covers that visually communicate each article's scientific domain and key thesis.

**Architecture:** Keep the feature frontend-first to avoid server cost: no bitmap generation, no image storage, no external image APIs. Add a small deterministic rendering intelligence layer that maps arXiv tags to visual domains, extracts a compact thesis line from title/abstract, and renders an HTML/CSS cover in `ArticleCard` and `ArticleModal`. Backend can keep `imageUrl` for compatibility, but frontend should prefer the generated cover.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, CSS gradients/patterns, unittest static contract tests, Vite build.

---

## Product Decision

Use a rule-based visual engine, not neural/image generation.

Reason:
- Works for 5000+ articles without GPU/API/storage.
- Deterministic and testable.
- Easy to explain in the diploma as a low-resource semantic visual layer.
- Gives each tag/domain a recognizable visual language.

Working name: **Article Cover RRI** — Rendering Rules Intelligence. It is not a neural model; it is a deterministic mapping layer from scientific metadata to editorial visual grammar.

## Current Evidence

- Backend currently returns `https://picsum.photos/seed/paper-{id}/800/1000` from `_paper_image_url` in `backend-api/app/main.py`.
- Frontend fallback also uses `picsum.photos` in `frontend/services/api.ts`.
- `ArticleCard` and `ArticleModal` render `article.imageUrl` as a normal `<img>`.
- Existing cards use masonry layout, so covers need stable responsive dimensions and should not cause layout shifts.

## File Structure

- Create `frontend/services/articleVisuals.ts`: pure deterministic helpers for domain mapping, theme selection, thesis extraction, and stable cover variants.
- Create `frontend/components/ArticleCover.tsx`: reusable HTML/CSS editorial cover component.
- Modify `frontend/components/ArticleCard.tsx`: replace `<img>` with `ArticleCover`.
- Modify `frontend/components/ArticleModal.tsx`: replace hero `<img>` with `ArticleCover` or a modal-sized variant.
- Modify `frontend/services/api.ts`: remove `picsum` fallback dependency and keep `imageUrl` optional-compatible.
- Modify `frontend/types.ts`: make visual cover fields explicit if needed; keep backwards compatibility.
- Create `tests/test_article_visuals_contract.py`: static frontend contract tests for no `picsum`, domain mappings, and shared cover usage.
- Create `DOCS/sprint/editorial-article-covers.md`: document low-resource design and visual domains.

## Task 1: Add Static Contract Tests

**Files:**
- Create: `tests/test_article_visuals_contract.py`

- [ ] **Step 1: Write failing static tests**

Create `tests/test_article_visuals_contract.py`:

```python
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArticleVisualsContractTests(unittest.TestCase):
    def test_frontend_no_longer_depends_on_random_picsum_article_images(self) -> None:
        api_source = (REPO_ROOT / "frontend" / "services" / "api.ts").read_text(
            encoding="utf-8"
        )
        card_source = (REPO_ROOT / "frontend" / "components" / "ArticleCard.tsx").read_text(
            encoding="utf-8"
        )
        modal_source = (REPO_ROOT / "frontend" / "components" / "ArticleModal.tsx").read_text(
            encoding="utf-8"
        )

        self.assertNotIn("picsum.photos/seed/article", api_source)
        self.assertIn("ArticleCover", card_source)
        self.assertIn("ArticleCover", modal_source)

    def test_article_visual_engine_covers_major_scientific_domains(self) -> None:
        source = (
            REPO_ROOT / "frontend" / "services" / "articleVisuals.ts"
        ).read_text(encoding="utf-8")

        expected_domains = [
            "ai",
            "language",
            "vision",
            "security",
            "systems",
            "math",
            "physics",
            "biology",
            "finance",
            "economics",
            "statistics",
            "general",
        ]
        for domain in expected_domains:
            self.assertIn(domain, source)

        for tag in ["cs.AI", "cs.CL", "cs.CV", "math.OC", "q-bio.QM", "q-fin.RM", "stat.ML", "econ.EM", "quant-ph"]:
            self.assertIn(tag, source)

    def test_cover_component_uses_textual_thesis_not_server_bitmap(self) -> None:
        source = (
            REPO_ROOT / "frontend" / "components" / "ArticleCover.tsx"
        ).read_text(encoding="utf-8")

        self.assertIn("getArticleVisual", source)
        self.assertIn("thesis", source)
        self.assertIn("article.abstract", source)
        self.assertNotIn("<img", source)
        self.assertNotIn("canvas", source)
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
python3 -m unittest tests.test_article_visuals_contract
```

Expected: FAIL because `articleVisuals.ts` and `ArticleCover.tsx` do not exist yet, and card/modal still render `<img>`.

## Task 2: Create Rendering Rules Intelligence

**Files:**
- Create: `frontend/services/articleVisuals.ts`

- [ ] **Step 1: Implement pure visual helpers**

Create `frontend/services/articleVisuals.ts`:

```typescript
import { Article } from '../types';

export type ArticleVisualDomain =
  | 'ai'
  | 'language'
  | 'vision'
  | 'security'
  | 'systems'
  | 'math'
  | 'physics'
  | 'biology'
  | 'finance'
  | 'economics'
  | 'statistics'
  | 'general';

export interface ArticleVisual {
  domain: ArticleVisualDomain;
  label: string;
  thesis: string;
  eyebrow: string;
  palette: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    border: string;
  };
  pattern: 'network' | 'columns' | 'frames' | 'grid' | 'waves' | 'cells' | 'market' | 'proof';
  variant: number;
}

const DOMAIN_TAGS: Array<{ domain: ArticleVisualDomain; label: string; tags: string[] }> = [
  { domain: 'language', label: 'Language', tags: ['cs.CL'] },
  { domain: 'vision', label: 'Vision', tags: ['cs.CV', 'eess.IV'] },
  { domain: 'security', label: 'Security', tags: ['cs.CR'] },
  { domain: 'systems', label: 'Systems', tags: ['cs.OS', 'cs.DC', 'cs.DB', 'cs.NI', 'eess.SY'] },
  { domain: 'ai', label: 'AI Research', tags: ['cs.AI', 'cs.LG', 'cs.NE', 'stat.ML'] },
  { domain: 'math', label: 'Mathematics', tags: ['math.', 'math-ph'] },
  { domain: 'physics', label: 'Physics', tags: ['physics.', 'quant-ph', 'astro-ph.', 'cond-mat.', 'hep-', 'gr-qc', 'nlin.', 'nucl-'] },
  { domain: 'biology', label: 'Bio Systems', tags: ['q-bio.'] },
  { domain: 'finance', label: 'Quant Finance', tags: ['q-fin.'] },
  { domain: 'economics', label: 'Economics', tags: ['econ.'] },
  { domain: 'statistics', label: 'Statistics', tags: ['stat.'] },
];

const PALETTES: Record<ArticleVisualDomain, ArticleVisual['palette']> = {
  ai: { background: 'from-slate-950 via-cyan-950 to-emerald-900', foreground: 'text-white', muted: 'text-cyan-100/75', accent: 'bg-cyan-300', border: 'border-cyan-200/20' },
  language: { background: 'from-stone-50 via-zinc-100 to-stone-200', foreground: 'text-zinc-950', muted: 'text-zinc-600', accent: 'bg-red-700', border: 'border-zinc-900/10' },
  vision: { background: 'from-zinc-950 via-neutral-900 to-sky-950', foreground: 'text-white', muted: 'text-sky-100/70', accent: 'bg-sky-300', border: 'border-sky-200/20' },
  security: { background: 'from-neutral-950 via-red-950 to-zinc-950', foreground: 'text-white', muted: 'text-red-100/70', accent: 'bg-red-400', border: 'border-red-200/20' },
  systems: { background: 'from-slate-900 via-slate-800 to-indigo-950', foreground: 'text-white', muted: 'text-indigo-100/70', accent: 'bg-indigo-300', border: 'border-indigo-200/20' },
  math: { background: 'from-white via-slate-100 to-zinc-200', foreground: 'text-slate-950', muted: 'text-slate-600', accent: 'bg-slate-950', border: 'border-slate-900/10' },
  physics: { background: 'from-black via-violet-950 to-slate-950', foreground: 'text-white', muted: 'text-violet-100/70', accent: 'bg-violet-300', border: 'border-violet-200/20' },
  biology: { background: 'from-emerald-950 via-teal-900 to-lime-900', foreground: 'text-white', muted: 'text-emerald-100/75', accent: 'bg-lime-300', border: 'border-lime-200/20' },
  finance: { background: 'from-zinc-950 via-emerald-950 to-stone-950', foreground: 'text-white', muted: 'text-emerald-100/70', accent: 'bg-emerald-300', border: 'border-emerald-200/20' },
  economics: { background: 'from-stone-900 via-amber-950 to-neutral-950', foreground: 'text-white', muted: 'text-amber-100/70', accent: 'bg-amber-300', border: 'border-amber-200/20' },
  statistics: { background: 'from-blue-950 via-slate-900 to-cyan-950', foreground: 'text-white', muted: 'text-blue-100/70', accent: 'bg-blue-300', border: 'border-blue-200/20' },
  general: { background: 'from-zinc-900 via-neutral-800 to-stone-900', foreground: 'text-white', muted: 'text-zinc-100/70', accent: 'bg-zinc-200', border: 'border-white/10' },
};

const PATTERNS: Record<ArticleVisualDomain, ArticleVisual['pattern']> = {
  ai: 'network',
  language: 'columns',
  vision: 'frames',
  security: 'grid',
  systems: 'grid',
  math: 'proof',
  physics: 'waves',
  biology: 'cells',
  finance: 'market',
  economics: 'market',
  statistics: 'grid',
  general: 'columns',
};

export const stableNumber = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const domainForTags = (tags: string[]): { domain: ArticleVisualDomain; label: string } => {
  for (const mapping of DOMAIN_TAGS) {
    if (tags.some(tag => mapping.tags.some(prefix => tag === prefix || tag.startsWith(prefix)))) {
      return { domain: mapping.domain, label: mapping.label };
    }
  }
  return { domain: 'general', label: 'Research' };
};

export const extractThesis = (title: string, abstract: string): string => {
  const source = (abstract || title).replace(/\\s+/g, ' ').trim();
  const sentence = source.split(/(?<=[.!?])\\s+/)[0] || title;
  const words = sentence.split(' ').filter(Boolean).slice(0, 18);
  return words.join(' ').replace(/[,:;]$/, '');
};

export const getArticleVisual = (article: Article): ArticleVisual => {
  const { domain, label } = domainForTags(article.tags || []);
  const variant = stableNumber(`${article.id}:${article.title}`) % 4;
  return {
    domain,
    label,
    thesis: extractThesis(article.title, article.abstract),
    eyebrow: (article.tags || [])[0] || article.source || 'Research',
    palette: PALETTES[domain],
    pattern: PATTERNS[domain],
    variant,
  };
};
```

- [ ] **Step 2: Run contract test**

Run:

```bash
python3 -m unittest tests.test_article_visuals_contract
```

Expected: still FAIL because `ArticleCover` is not created and card/modal still use `<img>`.

## Task 3: Build Shared ArticleCover Component

**Files:**
- Create: `frontend/components/ArticleCover.tsx`

- [ ] **Step 1: Create component**

Create `frontend/components/ArticleCover.tsx`:

```tsx
import React from 'react';
import { Article } from '../types';
import { getArticleVisual } from '../services/articleVisuals';

interface ArticleCoverProps {
  article: Article;
  mode?: 'card' | 'modal' | 'compact';
}

const patternText = {
  network: 'NODE EDGE VECTOR GRAPH',
  columns: 'ABSTRACT METHOD RESULT DISCUSSION',
  frames: 'FRAME PIXEL OBJECT SIGNAL',
  grid: 'SYSTEM INDEX QUERY STATE',
  waves: 'FIELD WAVE PARTICLE ENERGY',
  cells: 'CELL GENE MODEL SAMPLE',
  market: 'SERIES RISK PRICE SHOCK',
  proof: 'LEMMA PROOF MAP SPACE',
};

export const ArticleCover: React.FC<ArticleCoverProps> = ({ article, mode = 'card' }) => {
  const visual = getArticleVisual(article);
  const isModal = mode === 'modal';
  const heightClass = isModal ? 'h-full min-h-[11rem]' : 'aspect-[4/5] min-h-[18rem]';
  const titleSize = isModal ? 'text-2xl md:text-4xl' : 'text-xl';

  return (
    <div
      className={`relative flex ${heightClass} w-full overflow-hidden rounded-2xl border ${visual.palette.border} bg-gradient-to-br ${visual.palette.background} ${visual.palette.foreground}`}
      aria-label={`${visual.label}: ${article.title}`}
    >
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-x-6 top-6 grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, index) => (
            <span key={index} className="h-px bg-current opacity-60" />
          ))}
        </div>
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-current" />
        <div className="absolute -bottom-20 left-6 h-56 w-56 rounded-full border border-current" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-5">
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.18em]">
          <span className={`${visual.palette.muted}`}>{visual.eyebrow}</span>
          <span className={`h-2 w-2 rounded-full ${visual.palette.accent}`} />
        </div>

        <div className="space-y-4">
          <p className={`max-w-[18rem] font-serif ${titleSize} font-semibold leading-tight tracking-normal`}>
            {visual.thesis}
          </p>
          <div className={`max-w-[18rem] text-[10px] font-semibold uppercase leading-relaxed tracking-[0.16em] ${visual.palette.muted}`}>
            {patternText[visual.pattern]}
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <span className="font-serif text-5xl leading-none opacity-90">
            {visual.label.slice(0, 1)}
          </span>
          <div className={`text-right text-[10px] font-bold uppercase tracking-[0.16em] ${visual.palette.muted}`}>
            <div>{visual.label}</div>
            <div>{new Date(article.publishedAt).getFullYear()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Run contract test**

Run:

```bash
python3 -m unittest tests.test_article_visuals_contract
```

Expected: FAIL only because `ArticleCard` and `ArticleModal` have not been wired yet.

## Task 4: Replace Card And Modal Images

**Files:**
- Modify: `frontend/components/ArticleCard.tsx`
- Modify: `frontend/components/ArticleModal.tsx`

- [ ] **Step 1: Wire ArticleCard**

In `frontend/components/ArticleCard.tsx`, add:

```tsx
import { ArticleCover } from './ArticleCover';
```

Replace the `<img src={article.imageUrl} ... />` block with:

```tsx
<ArticleCover article={article} mode="card" />
```

Keep the hover overlay actions unchanged.

- [ ] **Step 2: Wire ArticleModal**

In `frontend/components/ArticleModal.tsx`, add:

```tsx
import { ArticleCover } from './ArticleCover';
```

Replace the modal hero `<img src={article.imageUrl} ... />` with:

```tsx
<ArticleCover article={article} mode="modal" />
```

Keep the mobile gradient overlay if it still reads well over the generated cover.

- [ ] **Step 3: Run contract test**

Run:

```bash
python3 -m unittest tests.test_article_visuals_contract
```

Expected: PASS.

## Task 5: Remove Random Article Image Fallbacks

**Files:**
- Modify: `frontend/services/api.ts`
- Optionally modify: `backend-api/app/main.py`

- [ ] **Step 1: Remove frontend `picsum` fallback**

In `frontend/services/api.ts`, change:

```ts
imageUrl: article.imageUrl || `https://picsum.photos/seed/article-${article.id}/800/1000`,
```

to:

```ts
imageUrl: article.imageUrl || '',
```

- [ ] **Step 2: Decide backend compatibility**

Keep backend `_paper_image_url` unchanged for now to avoid API churn. The frontend no longer depends on that URL for cards/modals. A future backend cleanup can remove `picsum` after all surfaces use `ArticleCover`.

- [ ] **Step 3: Run frontend contract and existing tests**

Run:

```bash
python3 -m unittest tests.test_article_visuals_contract tests.test_frontend_mobile_nav tests.test_frontend_modals
```

Expected: PASS.

## Task 6: Build And Visual QA

**Files:**
- No new files unless QA exposes regressions.

- [ ] **Step 1: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 2: Start frontend/backend if needed**

Run:

```bash
docker compose up -d --build frontend backend-api
```

Expected: services start.

- [ ] **Step 3: Browser check**

Open `http://localhost:5740/`.

Verify:
- Feed cards show editorial covers, not random photos.
- Covers have stable dimensions in masonry layout.
- Different domains look visibly different.
- Hover actions still work.
- Article modal shows the same editorial visual language.
- No relevant console errors.

## Task 7: Documentation

**Files:**
- Create: `DOCS/sprint/editorial-article-covers.md`
- Modify: `DOCS/BACKEND_TASKS.md` or create a new sprint note for Phase 3.7.

- [ ] **Step 1: Create sprint artifact**

Create `DOCS/sprint/editorial-article-covers.md`:

```markdown
# Editorial Article Covers

Date: 2026-05-24

## Goal

Replace random article images with deterministic, low-resource editorial covers that communicate domain and article thesis.

## Approach

The frontend renders covers using HTML/CSS. No server-side image generation, storage, canvas export, or external image API is required.

## Rendering Rules Intelligence

`frontend/services/articleVisuals.ts` maps article tags to visual domains and extracts a short thesis from title/abstract.

Domains:
- AI/ML
- Language
- Vision
- Security
- Systems
- Mathematics
- Physics
- Biology
- Finance
- Economics
- Statistics
- General research

## Verification

```bash
python3 -m unittest tests.test_article_visuals_contract
cd frontend && npm run build
```
```

- [ ] **Step 2: Add backend/frontend task note**

Add a short new section in `DOCS/BACKEND_TASKS.md` or sprint docs:

```markdown
## Этап 13. Editorial article covers

- [ ] T13.1 Rule-based visual domain mapping
- [ ] T13.2 Reusable ArticleCover component
- [ ] T13.3 Replace random card images
- [ ] T13.4 Replace modal hero image
- [ ] T13.5 Static tests and frontend build

**DoD:** карточки и модалки используют детерминированные editorial covers без случайных внешних изображений.
```

## Task 8: Final Verification

**Files:**
- No code changes unless verification exposes failures.

- [ ] **Step 1: Run all relevant tests**

Run:

```bash
python3 -m unittest \
  tests.test_article_visuals_contract \
  tests.test_frontend_mobile_nav \
  tests.test_frontend_modals \
  tests.test_frontend_i18n
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 3: Run smoke if services are up**

Run:

```bash
python3 scripts/smoke_api.py --include-hybrid-rank
```

Expected: PASS.

## Self-Review

- Spec coverage: covers cheap rendering, no random images, thesis extraction, tag/domain styling, card/modal integration, tests, build, docs.
- Placeholder scan: no `TBD` or undefined implementation placeholders.
- Type consistency: `ArticleVisualDomain`, `ArticleVisual`, `getArticleVisual`, `ArticleCover`, and `mode` names are consistent across tasks.
