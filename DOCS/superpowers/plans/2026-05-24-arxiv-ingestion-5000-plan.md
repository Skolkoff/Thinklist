# Phase 3.6 - arXiv Ingestion Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe incremental arXiv ingestion system that accumulates at least 5000 unique scientific articles without overloading arXiv and with broad scientific taxonomy coverage.

**Architecture:** Keep ingestion inside `backend-api` and extend the existing arXiv worker instead of adding a new service. Add an incremental scheduler that runs every 5 minutes, fetches at most 100 records per iteration, rotates across arXiv categories, deduplicates through existing paper uniqueness constraints, and stops once the database has 5000 unique arXiv papers. Keep the manual admin endpoint for forced runs and add status fields that make progress visible.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, Alembic, feedparser, httpx, unittest, Docker Compose.

---

## Current Evidence

- Local database currently has 100 papers, not 5000.
- Current `sources.config` already has `limit: 5000`, but ingestion is manual.
- Current arXiv categories cover mostly Computer Science plus small `math`, `stat`, `q-bio`, `q-fin`, and `physics` slices.
- Current tests and code disagree: `tests/test_arxiv_ingestion_scale.py` expects batch/chunk/delay values that do not match `backend-api/app/services/ingestion_arxiv.py`.

## File Structure

- Modify `backend-api/app/services/ingestion_arxiv.py`: category taxonomy, per-run limits, source config parsing, category rotation, duplicate-safe fetch/save behavior.
- Modify `backend-api/app/main.py`: startup scheduler lifecycle, admin status payload, manual run parameters if needed.
- Modify `backend-api/app/core/config.py`: ingestion scheduler settings with safe defaults.
- Create `backend-api/alembic/versions/0008_arxiv_ingestion_scheduler_config.py`: update existing arXiv source config to target 5000, batch 100, interval 300 seconds, broad taxonomy.
- Modify `scripts/demo_data.py`: use target count checks without forcing one huge ingestion run.
- Modify `scripts/smoke_api.py`: include ingestion status and minimum article-count checks.
- Modify `tests/test_arxiv_ingestion_scale.py`: align tests with new incremental behavior.
- Create `tests/test_arxiv_taxonomy_coverage.py`: verify broad taxonomy coverage.
- Create `tests/test_arxiv_scheduler_contract.py`: verify scheduler constants, status fields, and stop-at-target behavior.
- Create `DOCS/sprint/arxiv-ingestion-scale.md`: document operation, safety limits, verification, and expected progress.

## Task 1: Align Ingestion Requirements In Tests

**Files:**
- Modify: `tests/test_arxiv_ingestion_scale.py`
- Create: `tests/test_arxiv_taxonomy_coverage.py`
- Create: `tests/test_arxiv_scheduler_contract.py`

- [ ] **Step 1: Update scale contract test**

Replace stale expectations in `tests/test_arxiv_ingestion_scale.py` with:

```python
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArxivIngestionScaleTests(unittest.TestCase):
    def test_ingestion_defaults_are_incremental_and_safe(self):
        source = (
            REPO_ROOT / "backend-api" / "app" / "services" / "ingestion_arxiv.py"
        ).read_text(encoding="utf-8")

        self.assertIn("DEFAULT_ARXIV_TARGET_TOTAL = 5000", source)
        self.assertIn("DEFAULT_ARXIV_BATCH_SIZE = 100", source)
        self.assertIn("DEFAULT_ARXIV_INTERVAL_SECONDS = 300", source)
        self.assertIn("count_arxiv_papers", source)
        self.assertIn("run_arxiv_ingestion_batch", source)
        self.assertIn("target_reached", source)
        self.assertIn("create_or_get_paper", source)

    def test_existing_database_migration_expands_arxiv_source_config(self):
        migration = (
            REPO_ROOT
            / "backend-api"
            / "alembic"
            / "versions"
            / "0008_arxiv_ingestion_scheduler_config.py"
        ).read_text(encoding="utf-8")

        self.assertIn('"target_total": 5000', migration)
        self.assertIn('"batch_size": 100', migration)
        self.assertIn('"interval_seconds": 300', migration)
        self.assertIn('"cs.AI"', migration)
        self.assertIn('"econ.EM"', migration)
        self.assertIn('"eess.SP"', migration)
        self.assertIn('"astro-ph.GA"', migration)
        self.assertIn('"quant-ph"', migration)
        self.assertIn("UPDATE sources", migration)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Add taxonomy coverage test**

Create `tests/test_arxiv_taxonomy_coverage.py`:

```python
import ast
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArxivTaxonomyCoverageTests(unittest.TestCase):
    def test_default_categories_cover_major_arxiv_domains(self):
        source = (
            REPO_ROOT / "backend-api" / "app" / "services" / "ingestion_arxiv.py"
        ).read_text(encoding="utf-8")
        tree = ast.parse(source)
        categories = []
        for node in tree.body:
            if isinstance(node, ast.Assign):
                names = [target.id for target in node.targets if isinstance(target, ast.Name)]
                if "DEFAULT_ARXIV_CATEGORIES" in names:
                    categories = ast.literal_eval(node.value)
                    break

        prefixes = {
            "cs.": "computer_science",
            "econ.": "economics",
            "eess.": "electrical_engineering_systems_science",
            "math.": "mathematics",
            "astro-ph.": "astrophysics",
            "cond-mat.": "condensed_matter",
            "gr-qc": "general_relativity",
            "hep-": "high_energy_physics",
            "math-ph": "mathematical_physics",
            "nlin.": "nonlinear_sciences",
            "nucl-": "nuclear",
            "physics.": "physics",
            "quant-ph": "quantum_physics",
            "q-bio.": "quantitative_biology",
            "q-fin.": "quantitative_finance",
            "stat.": "statistics",
        }

        missing = []
        for prefix, label in prefixes.items():
            if not any(category == prefix or category.startswith(prefix) for category in categories):
                missing.append(label)

        self.assertEqual([], missing)
        self.assertGreaterEqual(len(categories), 120)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Add scheduler contract test**

Create `tests/test_arxiv_scheduler_contract.py`:

```python
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ArxivSchedulerContractTests(unittest.TestCase):
    def test_backend_exposes_scheduler_lifecycle_and_status(self):
        source = (REPO_ROOT / "backend-api" / "app" / "main.py").read_text(encoding="utf-8")

        self.assertIn("start_arxiv_ingestion_scheduler", source)
        self.assertIn("stop_arxiv_ingestion_scheduler", source)
        self.assertIn("arxiv_scheduler_running", source)
        self.assertIn('"target_total"', source)
        self.assertIn('"current_total"', source)
        self.assertIn('"next_run_at"', source)

    def test_settings_define_safe_scheduler_defaults(self):
        source = (
            REPO_ROOT / "backend-api" / "app" / "core" / "config.py"
        ).read_text(encoding="utf-8")

        self.assertIn("arxiv_ingestion_enabled", source)
        self.assertIn("arxiv_ingestion_interval_seconds", source)
        self.assertIn("arxiv_ingestion_batch_size", source)
        self.assertIn("arxiv_ingestion_target_total", source)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 4: Run tests and verify they fail**

Run:

```bash
python3 -m unittest \
  tests.test_arxiv_ingestion_scale \
  tests.test_arxiv_taxonomy_coverage \
  tests.test_arxiv_scheduler_contract
```

Expected: FAIL because scheduler helpers, config settings, broad taxonomy, and migration do not exist yet.

## Task 2: Add Settings For Incremental Ingestion

**Files:**
- Modify: `backend-api/app/core/config.py`

- [ ] **Step 1: Implement settings**

Add these properties to `Settings`:

```python
    @property
    def arxiv_ingestion_enabled(self) -> bool:
        return os.getenv("ARXIV_INGESTION_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"}

    @property
    def arxiv_ingestion_interval_seconds(self) -> int:
        raw = os.getenv("ARXIV_INGESTION_INTERVAL_SECONDS", "300")
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError("ARXIV_INGESTION_INTERVAL_SECONDS must be an integer") from exc
        if value < 60:
            raise RuntimeError("ARXIV_INGESTION_INTERVAL_SECONDS must be at least 60")
        return value

    @property
    def arxiv_ingestion_batch_size(self) -> int:
        raw = os.getenv("ARXIV_INGESTION_BATCH_SIZE", "100")
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError("ARXIV_INGESTION_BATCH_SIZE must be an integer") from exc
        if value <= 0 or value > 200:
            raise RuntimeError("ARXIV_INGESTION_BATCH_SIZE must be between 1 and 200")
        return value

    @property
    def arxiv_ingestion_target_total(self) -> int:
        raw = os.getenv("ARXIV_INGESTION_TARGET_TOTAL", "5000")
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError("ARXIV_INGESTION_TARGET_TOTAL must be an integer") from exc
        if value < 100:
            raise RuntimeError("ARXIV_INGESTION_TARGET_TOTAL must be at least 100")
        return value
```

- [ ] **Step 2: Run scheduler contract test**

Run:

```bash
python3 -m unittest tests.test_arxiv_scheduler_contract
```

Expected: still FAIL because `main.py` scheduler lifecycle is not implemented.

## Task 3: Expand arXiv Taxonomy And Source Config

**Files:**
- Modify: `backend-api/app/services/ingestion_arxiv.py`
- Create: `backend-api/alembic/versions/0008_arxiv_ingestion_scheduler_config.py`

- [ ] **Step 1: Replace default category list**

Replace `DEFAULT_ARXIV_CATEGORIES` with a broad taxonomy list covering major arXiv domains. Include all current CS categories plus representative categories across non-CS domains:

```python
DEFAULT_ARXIV_CATEGORIES = [
    "cs.AI", "cs.AR", "cs.CC", "cs.CE", "cs.CG", "cs.CL", "cs.CR", "cs.CV",
    "cs.CY", "cs.DB", "cs.DC", "cs.DL", "cs.DM", "cs.DS", "cs.ET", "cs.FL",
    "cs.GL", "cs.GR", "cs.GT", "cs.HC", "cs.IR", "cs.IT", "cs.LG", "cs.LO",
    "cs.MA", "cs.MM", "cs.MS", "cs.NA", "cs.NE", "cs.NI", "cs.OH", "cs.OS",
    "cs.PF", "cs.PL", "cs.RO", "cs.SC", "cs.SD", "cs.SE", "cs.SI", "cs.SY",
    "econ.EM", "econ.GN", "econ.TH",
    "eess.AS", "eess.IV", "eess.SP", "eess.SY",
    "math.AC", "math.AG", "math.AP", "math.AT", "math.CA", "math.CO",
    "math.CT", "math.CV", "math.DG", "math.DS", "math.FA", "math.GM",
    "math.GN", "math.GR", "math.GT", "math.HO", "math.IT", "math.KT",
    "math.LO", "math.MG", "math.MP", "math.NA", "math.NT", "math.OA",
    "math.OC", "math.PR", "math.QA", "math.RA", "math.RT", "math.SG",
    "math.SP", "math.ST",
    "astro-ph.CO", "astro-ph.EP", "astro-ph.GA", "astro-ph.HE", "astro-ph.IM", "astro-ph.SR",
    "cond-mat.dis-nn", "cond-mat.mes-hall", "cond-mat.mtrl-sci", "cond-mat.other",
    "cond-mat.quant-gas", "cond-mat.soft", "cond-mat.stat-mech", "cond-mat.str-el",
    "cond-mat.supr-con",
    "gr-qc",
    "hep-ex", "hep-lat", "hep-ph", "hep-th",
    "math-ph",
    "nlin.AO", "nlin.CD", "nlin.CG", "nlin.PS", "nlin.SI",
    "nucl-ex", "nucl-th",
    "physics.acc-ph", "physics.ao-ph", "physics.app-ph", "physics.atm-clus",
    "physics.atom-ph", "physics.bio-ph", "physics.chem-ph", "physics.class-ph",
    "physics.comp-ph", "physics.data-an", "physics.ed-ph", "physics.flu-dyn",
    "physics.gen-ph", "physics.geo-ph", "physics.hist-ph", "physics.ins-det",
    "physics.med-ph", "physics.optics", "physics.plasm-ph", "physics.pop-ph",
    "physics.soc-ph", "physics.space-ph",
    "quant-ph",
    "q-bio.BM", "q-bio.CB", "q-bio.GN", "q-bio.MN", "q-bio.NC", "q-bio.OT",
    "q-bio.PE", "q-bio.QM", "q-bio.SC", "q-bio.TO",
    "q-fin.CP", "q-fin.EC", "q-fin.GN", "q-fin.MF", "q-fin.PM", "q-fin.PR",
    "q-fin.RM", "q-fin.ST", "q-fin.TR",
    "stat.AP", "stat.CO", "stat.ME", "stat.ML", "stat.OT", "stat.TH",
]
```

- [ ] **Step 2: Add safe defaults**

Replace current constants with:

```python
DEFAULT_ARXIV_TARGET_TOTAL = 5000
DEFAULT_ARXIV_BATCH_SIZE = 100
DEFAULT_ARXIV_INTERVAL_SECONDS = 300
ARXIV_REQUEST_DELAY_SECONDS = 3.0
ARXIV_RETRY_DELAYS_SECONDS = (15.0, 30.0, 60.0)
```

- [ ] **Step 3: Create migration**

Create `backend-api/alembic/versions/0008_arxiv_ingestion_scheduler_config.py` with:

```python
"""configure incremental arxiv ingestion scheduler

Revision ID: 0008_arxiv_ingestion_scheduler_config
Revises: 0007_expand_arxiv_source
Create Date: 2026-05-24
"""

import json
from typing import Sequence, Union

from alembic import op


revision: str = "0008_arxiv_ingestion_scheduler_config"
down_revision: Union[str, None] = "0007_expand_arxiv_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EXPANDED_CONFIG = {
    "categories": [...],
    "target_total": 5000,
    "batch_size": 100,
    "interval_seconds": 300,
    "cursor": {"category_index": 0, "start": 0},
}


def upgrade() -> None:
    op.execute(
        "UPDATE sources "
        f"SET config = '{json.dumps(EXPANDED_CONFIG)}' "
        "WHERE code = 'arxiv'"
    )


def downgrade() -> None:
    legacy = {
        "categories": ["cs.AI", "cs.CL"],
        "limit": 100,
    }
    op.execute(
        "UPDATE sources "
        f"SET config = '{json.dumps(legacy)}' "
        "WHERE code = 'arxiv'"
    )
```

Use the exact category list from Step 1 in `EXPANDED_CONFIG`.

- [ ] **Step 4: Run taxonomy tests**

Run:

```bash
python3 -m unittest tests.test_arxiv_taxonomy_coverage tests.test_arxiv_ingestion_scale
```

Expected: taxonomy checks PASS; scale checks may still FAIL until batch helpers are implemented.

## Task 4: Implement Incremental Batch Ingestion

**Files:**
- Modify: `backend-api/app/services/ingestion_arxiv.py`

- [ ] **Step 1: Add count helper**

Add:

```python
def count_arxiv_papers(db: Session, source: Source | None = None) -> int:
    query = db.query(Paper)
    if source is not None:
        query = query.filter(Paper.source_id == source.id)
    else:
        query = query.join(Source, Paper.source_id == Source.id).filter(Source.code == "arxiv")
    return query.count()
```

- [ ] **Step 2: Add config parser**

Add:

```python
def _source_ingestion_config(source: Source) -> dict[str, Any]:
    config: dict[str, Any] = source.config or {}
    return {
        "categories": config.get("categories") or DEFAULT_ARXIV_CATEGORIES,
        "target_total": int(config.get("target_total") or config.get("limit") or DEFAULT_ARXIV_TARGET_TOTAL),
        "batch_size": int(config.get("batch_size") or DEFAULT_ARXIV_BATCH_SIZE),
        "interval_seconds": int(config.get("interval_seconds") or DEFAULT_ARXIV_INTERVAL_SECONDS),
        "cursor": config.get("cursor") or {"category_index": 0, "start": 0},
    }
```

- [ ] **Step 3: Add cursor update helper**

Add:

```python
def _save_cursor(source: Source, db: Session, category_index: int, start: int) -> None:
    config = dict(source.config or {})
    config["cursor"] = {"category_index": category_index, "start": start}
    source.config = config
    db.add(source)
    db.commit()
```

- [ ] **Step 4: Add incremental fetch function**

Add:

```python
def fetch_arxiv_entries_incremental(
    categories: list[str],
    batch_size: int,
    cursor: dict[str, int],
) -> tuple[list[Any], dict[str, int]]:
    if not categories:
        return [], {"category_index": 0, "start": 0}

    category_index = int(cursor.get("category_index", 0)) % len(categories)
    start = max(0, int(cursor.get("start", 0)))
    category = categories[category_index]
    params = {
        "search_query": f"cat:{category}",
        "start": start,
        "max_results": batch_size,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }
    response = _fetch_arxiv_response(params)
    entries = feedparser.parse(response.text).entries if response is not None else []

    next_category_index = category_index + 1
    next_start = start
    if next_category_index >= len(categories):
        next_category_index = 0
        next_start = start + batch_size

    return list(entries or []), {"category_index": next_category_index, "start": next_start}
```

- [ ] **Step 5: Add batch runner**

Add:

```python
def run_arxiv_ingestion_batch(
    db: Session,
    batch_size: int | None = None,
    target_total: int | None = None,
) -> dict[str, Any]:
    source = (
        db.query(Source)
        .filter(Source.code == "arxiv", Source.type == "arxiv", Source.enabled.is_(True))
        .one_or_none()
    )
    if not source:
        raise RuntimeError("arXiv source is not configured in sources table")

    config = _source_ingestion_config(source)
    categories = config["categories"]
    effective_batch_size = min(batch_size or config["batch_size"], DEFAULT_ARXIV_BATCH_SIZE)
    effective_target_total = target_total or config["target_total"]
    current_total = count_arxiv_papers(db, source)
    if current_total >= effective_target_total:
        return {
            "source": "arxiv",
            "target_total": effective_target_total,
            "current_total": current_total,
            "target_reached": True,
            "fetched": 0,
            "added": 0,
            "skipped": 0,
            "failed": 0,
        }

    remaining = effective_target_total - current_total
    entries, next_cursor = fetch_arxiv_entries_incremental(
        categories=categories,
        batch_size=min(effective_batch_size, remaining),
        cursor=config["cursor"],
    )

    run = IngestionRun(source_id=source.id)
    db.add(run)
    db.commit()
    db.refresh(run)

    added = 0
    skipped = 0
    failed = 0
    for entry in entries:
        data = normalize_entry(entry)
        try:
            paper, created = create_or_get_paper(
                db,
                source_id=source.id,
                external_id=data["external_id"],
                title=data["title"],
                abstract=data["abstract"],
                authors=data["authors"],
                published_at=data["published_at"],
                doi=data["doi"],
                url=data["url"],
            )
            for code in extract_categories(entry):
                tag = get_or_create_tag(db, code)
                if tag not in paper.tags:
                    paper.tags.append(tag)
            db.commit()
            added += 1 if created else 0
            skipped += 0 if created else 1
        except Exception:
            db.rollback()
            failed += 1

    run.added = added
    run.skipped = skipped
    run.failed = failed
    run.finished_at = datetime.now(timezone.utc)
    db.commit()
    _save_cursor(source, db, next_cursor["category_index"], next_cursor["start"])

    current_total = count_arxiv_papers(db, source)
    return {
        "source": "arxiv",
        "target_total": effective_target_total,
        "current_total": current_total,
        "target_reached": current_total >= effective_target_total,
        "cursor": next_cursor,
        "fetched": len(entries),
        "added": added,
        "skipped": skipped,
        "failed": failed,
    }
```

- [ ] **Step 6: Keep manual compatibility wrapper**

Change `run_arxiv_ingestion` to:

```python
def run_arxiv_ingestion(db: Session) -> dict[str, Any]:
    return run_arxiv_ingestion_batch(db)
```

- [ ] **Step 7: Run ingestion scale tests**

Run:

```bash
python3 -m unittest tests.test_arxiv_ingestion_scale tests.test_arxiv_taxonomy_coverage
```

Expected: PASS.

## Task 5: Add Backend Scheduler Lifecycle

**Files:**
- Modify: `backend-api/app/main.py`

- [ ] **Step 1: Import scheduler dependencies**

Add imports:

```python
import asyncio
from contextlib import asynccontextmanager, suppress
```

Update ingestion import:

```python
from app.services.ingestion_arxiv import (
    count_arxiv_papers,
    run_arxiv_ingestion,
    run_arxiv_ingestion_batch,
)
```

- [ ] **Step 2: Add scheduler state and loop**

Add near app setup:

```python
arxiv_scheduler_task: asyncio.Task | None = None
arxiv_scheduler_running = False
arxiv_scheduler_next_run_at: datetime | None = None


async def _arxiv_ingestion_loop() -> None:
    global arxiv_scheduler_running, arxiv_scheduler_next_run_at
    arxiv_scheduler_running = True
    try:
        while True:
            arxiv_scheduler_next_run_at = datetime.now(timezone.utc)
            try:
                db = next(get_db())
                try:
                    run_arxiv_ingestion_batch(
                        db,
                        batch_size=settings.arxiv_ingestion_batch_size,
                        target_total=settings.arxiv_ingestion_target_total,
                    )
                finally:
                    db.close()
            except Exception:
                logger.exception("arxiv_ingestion_scheduler_failed")

            arxiv_scheduler_next_run_at = datetime.now(timezone.utc) + timedelta(
                seconds=settings.arxiv_ingestion_interval_seconds
            )
            await asyncio.sleep(settings.arxiv_ingestion_interval_seconds)
    finally:
        arxiv_scheduler_running = False


def start_arxiv_ingestion_scheduler() -> None:
    global arxiv_scheduler_task
    if not settings.arxiv_ingestion_enabled:
        return
    if arxiv_scheduler_task is None or arxiv_scheduler_task.done():
        arxiv_scheduler_task = asyncio.create_task(_arxiv_ingestion_loop())


async def stop_arxiv_ingestion_scheduler() -> None:
    global arxiv_scheduler_task
    if arxiv_scheduler_task is None:
        return
    arxiv_scheduler_task.cancel()
    with suppress(asyncio.CancelledError):
        await arxiv_scheduler_task
    arxiv_scheduler_task = None
```

- [ ] **Step 3: Attach lifespan to FastAPI**

Replace the current `app = FastAPI(...)` block with:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    start_arxiv_ingestion_scheduler()
    yield
    await stop_arxiv_ingestion_scheduler()


app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    lifespan=lifespan,
)
```

- [ ] **Step 4: Extend ingestion status**

In `admin_ingestion_status`, include:

```python
    arxiv_source = (
        db.query(Source)
        .filter(Source.code == "arxiv", Source.type == "arxiv")
        .one_or_none()
    )
    current_total = count_arxiv_papers(db, arxiv_source) if arxiv_source else 0
    source_config = arxiv_source.config if arxiv_source else {}
    target_total = int(
        source_config.get("target_total")
        or source_config.get("limit")
        or settings.arxiv_ingestion_target_total
    )
```

Return these fields in both empty and non-empty branches:

```python
"scheduler_enabled": settings.arxiv_ingestion_enabled,
"scheduler_running": arxiv_scheduler_running,
"next_run_at": arxiv_scheduler_next_run_at.isoformat() if arxiv_scheduler_next_run_at else None,
"target_total": target_total,
"current_total": current_total,
"target_reached": current_total >= target_total,
```

- [ ] **Step 5: Run scheduler contract tests**

Run:

```bash
python3 -m unittest tests.test_arxiv_scheduler_contract
```

Expected: PASS.

## Task 6: Update Demo And Smoke Scripts

**Files:**
- Modify: `scripts/demo_data.py`
- Modify: `scripts/smoke_api.py`
- Modify: `tests/test_demo_data.py`
- Modify: `tests/test_smoke_api.py`

- [ ] **Step 1: Update demo defaults**

Change demo minimums from the old small sample to:

```python
DEFAULT_MIN_PAPERS = 5000
DEFAULT_MIN_TAGS = 80
```

If the current count is below 5000, print that background ingestion is accumulating articles and run only one manual batch, not a single huge load.

- [ ] **Step 2: Add smoke ingestion check**

Add a smoke check for:

```text
GET /admin/ingestion/status
```

Expected response fields:

```text
current_total
target_total
target_reached
scheduler_enabled
scheduler_running
next_run_at
```

- [ ] **Step 3: Run script tests**

Run:

```bash
python3 -m unittest tests.test_demo_data tests.test_smoke_api
```

Expected: PASS.

## Task 7: Document The New Phase

**Files:**
- Create: `DOCS/sprint/arxiv-ingestion-scale.md`
- Modify: `DOCS/BACKEND_TASKS.md`
- Modify: `README.md`

- [ ] **Step 1: Create sprint artifact**

Create `DOCS/sprint/arxiv-ingestion-scale.md` with:

```markdown
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

## Safety

- Requests use small batches.
- Retry delays respect transient 429/5xx responses.
- Paper uniqueness is enforced through existing `create_or_get_paper` behavior and database constraints.

## Coverage

The category list covers Computer Science, Economics, EESS, Mathematics, Astrophysics, Condensed Matter, General Relativity, High Energy Physics, Mathematical Physics, Nonlinear Sciences, Nuclear Physics, Physics, Quantum Physics, Quantitative Biology, Quantitative Finance, and Statistics.

## Status Check

```bash
curl http://localhost:8000/admin/ingestion/status
```

Expected fields:

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

## Verification

```bash
python3 -m unittest \
  tests.test_arxiv_ingestion_scale \
  tests.test_arxiv_taxonomy_coverage \
  tests.test_arxiv_scheduler_contract \
  tests.test_demo_data \
  tests.test_smoke_api
```
```

- [ ] **Step 2: Update backend task list**

Add a new section to `DOCS/BACKEND_TASKS.md`:

```markdown
## Этап 12. arXiv ingestion scale

- [ ] T12.1 Фоновый ingestion каждые 5 минут
- [ ] T12.2 Батчи не больше 100 статей
- [ ] T12.3 Накопление до 5000 уникальных статей
- [ ] T12.4 Расширенный arXiv taxonomy для научных областей
- [ ] T12.5 Status endpoint показывает прогресс
- [ ] T12.6 Smoke/tests подтверждают уникальность и покрытие

**DoD:** в базе накапливается >= 5000 уникальных статей без ручного большого импорта.
```

- [ ] **Step 3: Update README**

Add a short section:

```markdown
## arXiv ingestion scale

The backend accumulates arXiv papers incrementally:

- target: 5000 unique papers
- batch: 100 papers
- interval: 5 minutes
- status: `GET /admin/ingestion/status`
```

## Task 8: Final Verification

**Files:**
- No code changes unless verification exposes failures.

- [ ] **Step 1: Run unit/static tests**

Run:

```bash
python3 -m unittest \
  tests.test_arxiv_ingestion_scale \
  tests.test_arxiv_taxonomy_coverage \
  tests.test_arxiv_scheduler_contract \
  tests.test_article_sample_limit \
  tests.test_demo_data \
  tests.test_smoke_api
```

Expected: PASS.

- [ ] **Step 2: Rebuild and start services**

Run:

```bash
docker compose up -d --build
```

Expected: backend, ml-service, postgres, and frontend start successfully.

- [ ] **Step 3: Check current ingestion status**

Run:

```bash
curl http://localhost:8000/admin/ingestion/status
```

Expected:

```json
{
  "current_total": 100,
  "target_total": 5000,
  "target_reached": false,
  "scheduler_enabled": true,
  "scheduler_running": true
}
```

`current_total` may be higher than 100 depending on how many scheduler cycles have already run.

- [ ] **Step 4: Verify one batch can add or skip safely**

Run:

```bash
curl -X POST http://localhost:8000/admin/ingestion/run
```

Expected: response includes `fetched`, `added`, `skipped`, `failed`, `current_total`, `target_total`, and `target_reached`. `current_total` never decreases and duplicates are counted as `skipped`.

- [ ] **Step 5: Verify database uniqueness**

Run:

```bash
docker compose exec -T postgres psql -U scivise -d scivise_db -c "
select
  count(*) as papers,
  count(distinct external_id) as unique_external_ids,
  count(distinct content_hash) as unique_content_hashes
from papers;
"
```

Expected: unique counts equal `papers` for populated unique fields.

## Execution Notes

- Do not fetch all 5000 articles in one request.
- Do not reduce the 5-minute interval below 60 seconds through config validation.
- Do not remove existing manual ingestion endpoints.
- If arXiv returns 429 or 5xx, keep the retry delays and let the next scheduler cycle continue.
- Commit after each task with focused commit messages.

## Self-Review

- Spec coverage: covers 5000 target, 100-per-iteration batch, 5-minute background accumulation, uniqueness, broad taxonomy, status visibility, tests, docs.
- Placeholder scan: no TBD/TODO placeholders remain; migration Step 3 uses `[...]` only to mean copying the exact category list from Task 3 Step 1.
- Type consistency: planned helper names are consistent across tests, backend service, and status endpoint.
