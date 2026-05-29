# Neural Artifact Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional trained neural artifact loading to `ml-service` and surface model metadata through rebuild/rank responses.

**Architecture:** Keep inference in `ml-service`. Add a small artifact loader that can use PyTorch when available and gracefully report missing artifacts. Extend the existing recommender feature path to choose the project model for core candidates, the cross-domain model for adjacent candidates, and the current fallback scorer when artifacts are absent.

**Tech Stack:** FastAPI, NumPy, scikit-learn, optional PyTorch CPU inference, Python unittest.

---

### Task 1: Artifact Contract Tests

**Files:**
- Create: `tests/test_neural_artifact_contract.py`

- [ ] **Step 1: Write failing tests**

```python
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class NeuralArtifactContractTest(unittest.TestCase):
    def test_artifact_loader_module_and_expected_paths_exist(self) -> None:
        source_path = ROOT / "ml-service" / "app" / "services" / "neural_artifacts.py"
        self.assertTrue(source_path.exists())
        source = source_path.read_text(encoding="utf-8")
        self.assertIn("discovery_reranker_project_finetuned.pt", source)
        self.assertIn("cross_domain_boosted_reranker.pt", source)
        self.assertIn("NeuralArtifactBundle", source)
        self.assertIn("load_neural_artifacts", source)

    def test_rebuild_and_health_expose_artifact_status(self) -> None:
        main = (ROOT / "ml-service" / "app" / "main.py").read_text(encoding="utf-8")
        recommender = (ROOT / "ml-service" / "app" / "services" / "recommender.py").read_text(encoding="utf-8")
        self.assertIn("artifact_status", main)
        self.assertIn("get_artifact_status", main)
        self.assertIn("project_model_loaded", recommender)
        self.assertIn("cross_domain_model_loaded", recommender)

    def test_rank_response_contains_model_source(self) -> None:
        main = (ROOT / "ml-service" / "app" / "main.py").read_text(encoding="utf-8")
        recommender = (ROOT / "ml-service" / "app" / "services" / "recommender.py").read_text(encoding="utf-8")
        self.assertIn('"model": item.model', main)
        self.assertIn("project_finetuned", recommender)
        self.assertIn("cross_domain_boost", recommender)
        self.assertIn("hybrid_fallback", recommender)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m unittest tests.test_neural_artifact_contract`

Expected: FAIL because `neural_artifacts.py`, `artifact_status`, and ranked `model` fields do not exist yet.

### Task 2: Optional Artifact Loader

**Files:**
- Create: `ml-service/app/services/neural_artifacts.py`
- Modify: `ml-service/app/core/config.py`

- [ ] **Step 1: Implement loader**

Create a dataclass-backed loader that records expected file paths, optional scaler arrays, loaded model handles, and human-readable missing/error metadata. Import PyTorch inside the loader function so environments without `torch` can still import the module.

- [ ] **Step 2: Add artifacts directory setting**

Add `Settings.artifacts_dir`, returning `ML_ARTIFACTS_DIR` or `ml-service/artifacts`.

- [ ] **Step 3: Run artifact tests**

Run: `python3 -m unittest tests.test_neural_artifact_contract`

Expected: remaining failures only for recommender/main metadata integration.

### Task 3: Recommender Integration

**Files:**
- Modify: `ml-service/app/services/recommender.py`

- [ ] **Step 1: Extend ranked item shape**

Add `model: str` to `RankedPaper`.

- [ ] **Step 2: Extend model state**

Store `artifacts: NeuralArtifactBundle | None` in `ModelState`.

- [ ] **Step 3: Load artifacts during rebuild**

Call `load_neural_artifacts()` in `rebuild_index`, store status, and include `project_model_loaded`, `cross_domain_model_loaded`, and `artifact_status` in rebuild stats.

- [ ] **Step 4: Score with bucket-specific artifact**

For core candidates, try `project_finetuned`; for adjacent candidates, try `cross_domain_boost`. If inference is unavailable or fails, use existing fallback neural scoring.

- [ ] **Step 5: Run existing and new ML tests**

Run: `python3 -m unittest tests.test_neural_artifact_contract tests.test_hybrid_recommender_contract tests.test_recommendation_domains`

Expected: PASS.

### Task 4: FastAPI Response Metadata

**Files:**
- Modify: `ml-service/app/main.py`

- [ ] **Step 1: Add status helpers**

Import `get_artifact_status` from recommender.

- [ ] **Step 2: Extend `/health`**

Return `artifact_status` alongside `status` and `db`.

- [ ] **Step 3: Extend `/ml/rank` response**

Include `model` for each ranked item.

- [ ] **Step 4: Run tests**

Run: `python3 -m unittest tests.test_neural_artifact_contract tests.test_hybrid_recommender_contract`

Expected: PASS.

### Task 5: Documentation And Final Verification

**Files:**
- Modify: `DOCS/sprint/neural-model-backend-integration.md`
- Modify: `DOCS/BACKEND_TASKS.md`

- [ ] **Step 1: Document implemented fallback-safe integration**

Add an implementation note that artifacts are optional and loaded by `ml-service`.

- [ ] **Step 2: Run verification suite**

Run: `python3 -m unittest tests.test_neural_artifact_contract tests.test_hybrid_recommender_contract tests.test_recommendation_domains tests.test_smoke_api`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add DOCS ml-service tests
git commit -m "feat: integrate neural reranker artifacts"
```
