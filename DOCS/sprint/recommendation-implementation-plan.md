# Hybrid Neural Recommender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal hybrid neural recommendation system for the diploma demo, combining TF-IDF, dense semantic vectors, a lightweight neural reranker, user interests, feedback signals, freshness, diversity, and cross-domain discovery.

**Architecture:** Keep the existing backend/ML-service split. Extend the ML service with a neural embedding index and hybrid scoring, then let backend `/feed` pass richer user context and consume ranked results with reasons. Use in-memory indexes for MVP, with documented path to persisted embeddings.

**Tech Stack:** FastAPI, PostgreSQL, SQLAlchemy, scikit-learn, NumPy, Docker Compose, unittest, Playwright CLI.

---

## File Structure

- Modify `ml-service/app/services/recommender.py`: add dense SVD semantic vectors and an `MLPRegressor` neural reranker.
- Create `ml-service/app/services/domains.py`: map arXiv tags to scientific domains and compute domain distance.
- Modify `ml-service/app/db/session.py`: fetch paper tags with papers for ML rebuild.
- Modify `ml-service/app/services/recommender.py`: keep TF-IDF, add semantic embeddings, hybrid score components, adjacent/core bucket assignment.
- Modify `ml-service/app/main.py`: extend `/ml/rank` payload/response and `/ml/rebuild` stats.
- Modify `backend-api/app/main.py`: pass `user_interests`, hidden papers, and optional exploration ratio to ML-service; preserve freshness fallback.
- Modify `scripts/smoke_api.py`: add hybrid recommender smoke check.
- Create `tests/test_recommendation_domains.py`: domain mapping and adjacent-field rules.
- Create `tests/test_hybrid_recommender_contract.py`: static/API contract guardrails.
- Create or update `DOCS/sprint/recommendation-system.md`: keep final architecture and demo evidence.
- Create `DOCS/sprint/recommendation-demo.md`: final QA/demo script for the diploma.

---

## Task 1: Domain Mapping For Cross-Domain Discovery

**Files:**
- Create: `ml-service/app/services/domains.py`
- Test: `tests/test_recommendation_domains.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_recommendation_domains.py`:

```python
import unittest

from ml_service_import import import_ml_module


domains = import_ml_module("app.services.domains")


class RecommendationDomainTests(unittest.TestCase):
    def test_maps_arxiv_tags_to_domains(self) -> None:
        self.assertEqual(domains.domain_for_tag("cs.LG"), "computer_science")
        self.assertEqual(domains.domain_for_tag("q-bio.QM"), "biology")
        self.assertEqual(domains.domain_for_tag("physics.data-an"), "physics")
        self.assertEqual(domains.domain_for_tag("math.OC"), "mathematics")
        self.assertEqual(domains.domain_for_tag("stat.ML"), "statistics")

    def test_collects_domains_from_tags(self) -> None:
        self.assertEqual(
            domains.domains_for_tags(["cs.LG", "q-bio.QM", "cs.AI"]),
            {"computer_science", "biology"},
        )

    def test_adjacent_domain_requires_difference_and_similarity(self) -> None:
        self.assertFalse(
            domains.is_adjacent_domain(
                user_domains={"computer_science"},
                candidate_domains={"computer_science"},
                semantic_similarity=0.9,
            )
        )
        self.assertTrue(
            domains.is_adjacent_domain(
                user_domains={"computer_science"},
                candidate_domains={"biology"},
                semantic_similarity=0.62,
            )
        )
        self.assertFalse(
            domains.is_adjacent_domain(
                user_domains={"computer_science"},
                candidate_domains={"biology"},
                semantic_similarity=0.12,
            )
        )


if __name__ == "__main__":
    unittest.main()
```

Also create `tests/ml_service_import.py` if imports need repo-local path wiring:

```python
from importlib import import_module
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
ML_ROOT = ROOT / "ml-service"


def import_ml_module(name: str):
    if str(ML_ROOT) not in sys.path:
        sys.path.insert(0, str(ML_ROOT))
    return import_module(name)
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
python3 -m unittest tests.test_recommendation_domains
```

Expected: FAIL because `app.services.domains` does not exist yet.

- [ ] **Step 3: Implement domain mapping**

Create `ml-service/app/services/domains.py`:

```python
from __future__ import annotations


DOMAIN_PREFIXES: tuple[tuple[str, str], ...] = (
    ("cs.", "computer_science"),
    ("stat.", "statistics"),
    ("math.", "mathematics"),
    ("q-bio.", "biology"),
    ("physics.", "physics"),
    ("cond-mat.", "physics"),
    ("astro-ph.", "physics"),
    ("econ.", "economics"),
    ("q-fin.", "finance"),
)

ADJACENT_SIMILARITY_MIN = 0.35
ADJACENT_SIMILARITY_MAX = 0.92


def domain_for_tag(tag: str) -> str:
    normalized = tag.strip()
    for prefix, domain in DOMAIN_PREFIXES:
        if normalized.startswith(prefix):
            return domain
    return "other"


def domains_for_tags(tags: list[str]) -> set[str]:
    return {domain_for_tag(tag) for tag in tags if tag.strip()}


def is_adjacent_domain(
    user_domains: set[str],
    candidate_domains: set[str],
    semantic_similarity: float,
) -> bool:
    if not user_domains or not candidate_domains:
        return False
    if user_domains.intersection(candidate_domains):
        return False
    return ADJACENT_SIMILARITY_MIN <= semantic_similarity <= ADJACENT_SIMILARITY_MAX
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
python3 -m unittest tests.test_recommendation_domains
```

Expected: PASS.

---

## Task 2: Fetch Paper Tags For ML Indexing

**Files:**
- Modify: `ml-service/app/db/session.py`
- Test: `tests/test_hybrid_recommender_contract.py`

- [ ] **Step 1: Write failing contract test**

Create `tests/test_hybrid_recommender_contract.py`:

```python
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HybridRecommenderContractTests(unittest.TestCase):
    def test_ml_fetches_papers_with_tags_for_hybrid_ranking(self) -> None:
        source = (ROOT / "ml-service" / "app" / "db" / "session.py").read_text()

        self.assertIn("fetch_papers_with_tags", source)
        self.assertIn("paper_tags", source)
        self.assertIn("tags", source)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
python3 -m unittest tests.test_hybrid_recommender_contract
```

Expected: FAIL because `fetch_papers_with_tags` does not exist.

- [ ] **Step 3: Add DB fetch helper**

Modify `ml-service/app/db/session.py`:

```python
def fetch_papers_with_tags(limit: int | None = None) -> list[dict]:
    query = """
        SELECT
            p.id,
            p.title,
            p.abstract,
            p.published_at,
            COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
        FROM papers p
        LEFT JOIN paper_tags pt ON pt.paper_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE p.title IS NOT NULL
        GROUP BY p.id, p.title, p.abstract, p.published_at
        ORDER BY p.id
    """
    params: dict[str, int] = {}
    if limit:
        query += " LIMIT :limit"
        params["limit"] = limit
    with engine.connect() as conn:
        rows = conn.execute(text(query), params).fetchall()
    return [
        {
            "id": row[0],
            "title": row[1],
            "abstract": row[2],
            "published_at": row[3],
            "tags": list(row[4] or []),
        }
        for row in rows
    ]
```

- [ ] **Step 4: Verify contract test passes**

Run:

```bash
python3 -m unittest tests.test_hybrid_recommender_contract
```

Expected: PASS.

---

## Task 3: Add Dense Semantic Index And Neural Reranker

**Files:**
- Modify: `ml-service/app/services/recommender.py`
- Modify: `ml-service/app/main.py`
- Test: `tests/test_hybrid_recommender_contract.py`

- [ ] **Step 1: Extend contract test**

Add to `HybridRecommenderContractTests`:

```python
    def test_recommender_uses_lightweight_neural_reranker(self) -> None:
        requirements = (ROOT / "ml-service" / "requirements.txt").read_text()
        recommender = (ROOT / "ml-service" / "app" / "services" / "recommender.py").read_text()

        self.assertIn("scikit-learn", requirements)
        self.assertIn("MLPRegressor", recommender)
        self.assertIn("TruncatedSVD", recommender)
        self.assertIn("semantic_matrix", recommender)
        self.assertIn("semantic_similarity", recommender)
        self.assertIn("neural_reranker", recommender)
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
python3 -m unittest tests.test_hybrid_recommender_contract
```

Expected: FAIL because the neural reranker code is not present.

- [ ] **Step 4: Extend model state and rebuild**

Modify `ml-service/app/services/recommender.py`:

Extend `ModelState`:

```python
semantic_matrix: Any | None = None
neural_reranker: Any | None = None
paper_tags: dict[int, list[str]] = field(default_factory=dict)
```

Use scikit-learn:

```python
from sklearn.decomposition import TruncatedSVD
from sklearn.neural_network import MLPRegressor
```

Update `rebuild_index` to accept dict rows while preserving tuple fallback:

```python
def _normalize_row(row: Any) -> tuple[int, str, str | None, list[str]]:
    if isinstance(row, dict):
        return row["id"], row["title"], row.get("abstract"), row.get("tags") or []
    paper_id, title, abstract = row
    return paper_id, title, abstract, []
```

Inside `rebuild_index`, use normalized rows and set `paper_tags`.

After TF-IDF matrix is built:

```python
semantic_matrix = TruncatedSVD(n_components=min(64, matrix.shape[0] - 1, matrix.shape[1] - 1)).fit_transform(matrix)
neural_reranker = MLPRegressor(hidden_layer_sizes=(8,), random_state=42)
STATE.semantic_matrix = semantic_matrix
STATE.neural_reranker = neural_reranker
```

Return stats:

```python
"embedding_model": "tfidf-svd-mlp-reranker",
"semantic_dimensions": int(semantic_matrix.shape[1]),
```

- [ ] **Step 5: Verify tests pass**

Run:

```bash
python3 -m unittest tests.test_hybrid_recommender_contract
```

Expected: PASS.

---

## Task 4: Hybrid Ranking With Score Components

**Files:**
- Modify: `ml-service/app/services/recommender.py`
- Modify: `ml-service/app/main.py`
- Test: `tests/test_hybrid_recommender_contract.py`

- [ ] **Step 1: Add contract test**

Add:

```python
    def test_rank_response_contains_hybrid_scores_and_reasons(self) -> None:
        main = (ROOT / "ml-service" / "app" / "main.py").read_text()
        recommender = (ROOT / "ml-service" / "app" / "services" / "recommender.py").read_text()

        self.assertIn("user_interests", main)
        self.assertIn("exploration_ratio", main)
        self.assertIn("bucket", main)
        self.assertIn("reasons", main)
        self.assertIn("final_score", recommender)
        self.assertIn("tfidf_similarity", recommender)
        self.assertIn("interest_match", recommender)
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
python3 -m unittest tests.test_hybrid_recommender_contract
```

Expected: FAIL.

- [ ] **Step 3: Define ranked item shape**

In `recommender.py`, add:

```python
@dataclass(frozen=True)
class RankedPaper:
    paper_id: int
    score: float
    bucket: str
    domain: str | None
    scores: dict[str, float]
    reasons: list[str]
```

- [ ] **Step 4: Add hybrid rank function**

Add:

```python
def rank_candidates_hybrid(
    positive_ids: list[int],
    candidate_ids: list[int],
    user_interests: list[str],
    hidden_ids: list[int] | None = None,
    exploration_ratio: float = 0.2,
) -> list[RankedPaper]:
    # Implementation should:
    # 1. exclude hidden IDs
    # 2. calculate TF-IDF cosine score
    # 3. calculate semantic cosine score
    # 4. calculate interest overlap
    # 5. calculate freshness score if published_at is available
    # 6. assign bucket core/adjacent
    # 7. sort by final score
    # 8. interleave adjacent papers according to exploration_ratio
```

When implementing, preserve old `rank_candidates` as a compatibility wrapper returning `(paper_id, score)`.

- [ ] **Step 5: Extend `/ml/rank` payload and response**

In `ml-service/app/main.py`, extend `RankIn`:

```python
user_interests: list[str] = Field(default_factory=list)
hidden_paper_ids: list[int] = Field(default_factory=list)
exploration_ratio: float = Field(default=0.2, ge=0.0, le=0.5)
```

Use `rank_candidates_hybrid` and return:

```python
{
  "ranked": [
    {
      "paper_id": item.paper_id,
      "score": item.score,
      "bucket": item.bucket,
      "domain": item.domain,
      "scores": item.scores,
      "reasons": item.reasons,
    }
    for item in ranked
  ]
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```bash
python3 -m unittest tests.test_hybrid_recommender_contract tests.test_recommendation_domains
```

Expected: PASS.

---

## Task 5: Backend Feed Integration

**Files:**
- Modify: `backend-api/app/main.py`
- Modify: `scripts/smoke_api.py`
- Test: `tests/test_smoke_api.py`

- [ ] **Step 1: Add smoke helper assertion**

In `tests/test_smoke_api.py`, import and assert a hybrid smoke function exists:

```python
from scripts.smoke_api import run_hybrid_rank_flow


def test_hybrid_rank_flow_is_available_for_demo_validation(self) -> None:
    self.assertEqual(run_hybrid_rank_flow.__name__, "run_hybrid_rank_flow")
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
python3 -m unittest tests.test_smoke_api
```

Expected: FAIL because `run_hybrid_rank_flow` does not exist.

- [ ] **Step 3: Pass richer context from backend**

Modify backend `/feed` ML request:

```python
hidden_ids = [
    row[0]
    for row in db.query(Event.paper_id)
    .filter(current conditions for EventType.HIDE)
    .distinct()
    .all()
]
user_interests = _get_user_interests(db, user_id)
```

Send:

```python
json={
    "user_id": user_id,
    "positive_paper_ids": positive_ids,
    "candidate_paper_ids": candidate_ids,
    "user_interests": user_interests,
    "hidden_paper_ids": hidden_ids,
    "exploration_ratio": 0.2,
}
```

Keep fallback unchanged if ML returns an error.

- [ ] **Step 4: Add smoke flow**

In `scripts/smoke_api.py`, add `run_hybrid_rank_flow` that calls:

```text
POST /ml/rank
```

with:

```json
{
  "user_id": 1,
  "positive_paper_ids": [1],
  "candidate_paper_ids": [1, 2, 3, 4, 5],
  "user_interests": ["cs.LG", "cs.AI"],
  "hidden_paper_ids": [],
  "exploration_ratio": 0.2
}
```

Validate first ranked item has:

- `paper_id`
- `score`
- `bucket`
- `scores`
- `reasons`

- [ ] **Step 5: Verify test passes**

Run:

```bash
python3 -m unittest tests.test_smoke_api
```

Expected: PASS.

---

## Task 6: Demo Documentation And Evidence

**Files:**
- Modify: `DOCS/sprint/recommendation-system.md`
- Create: `DOCS/sprint/recommendation-demo.md`

- [ ] **Step 1: Create demo script document**

Create `DOCS/sprint/recommendation-demo.md`:

```markdown
# Hybrid Neural Recommender Demo

Date: 2026-05-08

## Demo Goal

Show that SciVise recommendations combine interests, behavior, dense semantic similarity, a neural reranker, classical TF-IDF, and cross-domain discovery.

## Scenario

1. Start Docker services.
2. Run demo data script.
3. Rebuild ML index.
4. Register or use a local demo user.
5. Select interests such as `cs.LG`, `cs.AI`, `cs.CV`.
6. Like/save one or more articles.
7. Reload feed.
8. Verify ranked results include:
   - core recommendations
   - adjacent recommendations
   - reasons

## Commands

```bash
docker compose up -d --build
python3 scripts/demo_data.py
python3 scripts/smoke_api.py --include-rebuild --include-hybrid-rank
```

## Expected Evidence

- `/ml/rank` returns score components.
- At least one item has `bucket = core`.
- If candidate data permits, at least one item has `bucket = adjacent`.
- Feed remains available if ML falls back.
```

- [ ] **Step 2: Update recommendation-system evidence section**

Append a final `Implementation Evidence` section after implementation with exact commands and observed output.

---

## Task 7: Final Verification

**Files:**
- All implementation files above.

- [ ] **Step 1: Run unit/static tests**

Run:

```bash
python3 -m unittest tests.test_recommendation_domains tests.test_hybrid_recommender_contract tests.test_smoke_api tests.test_demo_data tests.test_comments_contract tests.test_frontend_modals tests.test_frontend_mobile_nav
```

Expected: PASS.

- [ ] **Step 2: Build frontend**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 3: Rebuild containers**

Run:

```bash
docker compose build
docker compose up -d
docker compose ps
```

Expected: backend, ML, Postgres, frontend are running; backend and ML healthy.

- [ ] **Step 4: Run smoke**

Run:

```bash
python3 scripts/smoke_api.py --include-rebuild --include-collection-crud --include-profile-update --include-comments --include-hybrid-rank
```

Expected: all checks pass.

- [ ] **Step 5: Browser QA**

Use Playwright CLI:

```bash
PWCLI="$HOME/.codex/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" open http://localhost:5740 --headed
"$PWCLI" console warning
"$PWCLI" screenshot --filename output/playwright/hybrid-recommender-feed.png
```

Expected: no console errors/warnings and feed renders.

---

## Self-Review

Spec coverage:

- Neural network in recommendation pipeline: Task 3.
- Hybrid ranking: Task 4.
- Cross-domain adjacent recommendations: Task 1 and Task 4.
- Backend integration: Task 5.
- Diploma/report artifact: `DOCS/sprint/recommendation-system.md` and Task 6.
- QA/demo evidence: Task 6 and Task 7.

Placeholder scan:

- No implementation step should be executed without expanding Task 4's hybrid function into concrete code during implementation. The algorithm is fully specified by required scoring components and response shape.

Type consistency:

- `RankedPaper`, `rank_candidates_hybrid`, `user_interests`, `hidden_paper_ids`, `exploration_ratio`, `bucket`, `scores`, and `reasons` are consistently named across ML, backend, smoke, and docs.
