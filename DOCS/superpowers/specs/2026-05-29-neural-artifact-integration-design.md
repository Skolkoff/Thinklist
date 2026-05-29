# Neural Artifact Integration Design

Date: 2026-05-29

## Goal

Integrate trained Thinklist neural reranker artifacts into `ml-service` while preserving the current TF-IDF/SVD fallback path and the backend `/feed` contract.

## Context

The current `ml-service` builds an in-memory TF-IDF matrix, a dense SVD semantic matrix, and a lightweight `MLPRegressor` fallback during `/ml/rebuild`. `backend-api` already sends positive paper IDs, candidate IDs, user interests, hidden IDs, and `exploration_ratio` to `/ml/rank`. The missing piece is runtime artifact loading for the trained project reranker and cross-domain boost reranker described in `DOCS/sprint/neural-model-backend-integration.md`.

## Approach

Use an optional artifact layer inside `ml-service`, not the backend. The service will look for file-based artifacts under `ml-service/artifacts` by default, or an override path from `ML_ARTIFACTS_DIR`. If PyTorch or model files are unavailable, the existing hybrid scorer remains the active fallback.

This keeps demo startup resilient: missing `.pt` files do not break `/health`, `/ml/rebuild`, or `/feed`. When artifacts are present, `/ml/rebuild` reports which models loaded, and `/ml/rank` exposes the model source used for each ranked item.

## Components

- `ml-service/app/services/neural_artifacts.py`: optional loader for project and cross-domain model files plus scaler metadata.
- `ml-service/app/services/recommender.py`: owns feature construction, artifact-backed scoring, fallback scoring, and ranked item metadata.
- `ml-service/app/main.py`: exposes artifact status in `/health`, `/ml/rebuild`, and `/ml/rank` responses.
- `ml-service/app/core/config.py`: provides `artifacts_dir`.
- `tests/test_neural_artifact_contract.py`: contract tests for artifact status, fallback behavior, and response metadata.

## Artifact Layout

```text
ml-service/artifacts/
  project/
    discovery_reranker_project_finetuned.pt
    feature_scaler.npz
  cross_domain/
    cross_domain_boosted_reranker.pt
    cross_domain_feature_scaler.npz
```

`feature_scaler.npz` files may contain `mean` and `scale` arrays. If they are missing or incompatible, raw feature rows are passed to the model.

## Ranking Behavior

Each candidate still receives the existing baseline score components: semantic similarity, TF-IDF similarity, interest match, behavior boost, freshness, diversity penalty, and bucket indicator.

Core candidates prefer the project fine-tuned artifact. Adjacent candidates prefer the cross-domain artifact. If a bucket-specific artifact is missing, the service uses the current local fallback neural score and baseline blend. The final response includes:

- `model`: `project_finetuned`, `cross_domain_boost`, or `hybrid_fallback`;
- `scores.neural`: the neural or fallback neural score;
- `scores.baseline`: the deterministic baseline score;
- existing `bucket`, `domain`, `score`, and `reasons`.

## Error Handling

Artifact loading is best-effort. Import errors, missing files, scaler shape mismatches, or inference exceptions are captured as status metadata and do not crash the service. The only `model_not_ready` condition remains an empty/unbuilt recommendation index.

## Testing

Use TDD:

1. Add contract tests that fail until artifact status APIs and response metadata exist.
2. Implement optional artifact loader and fallback-safe scoring.
3. Verify existing hybrid recommendation tests still pass.
4. Verify import-time behavior works without PyTorch installed.

## Approval Note

The user explicitly requested: "прострой план с помощью @superpowers и по этому плану действуй до конца реализации интеграции." This design is scoped to that instruction and proceeds without adding frontend UI or changing backend inference ownership.
