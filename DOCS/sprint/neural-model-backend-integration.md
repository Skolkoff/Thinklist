# Neural Model Backend Integration

Date: 2026-05-29

## Purpose

This document describes how to integrate the trained Thinklist/SciVise neural recommendation models into the backend/ML-service runtime.

The goal is to keep request-time ranking fast and predictable:

- training stays in Google Colab;
- article embeddings are computed during ML rebuild, not during each feed request;
- backend requests only fast CPU inference from ML-service;
- the final feed mixes normal recommendations and cross-domain discovery recommendations.

## Model Roles

Thinklist now has two useful trained model families.

### Project Fine-Tuned Model

Artifact:

```text
discovery_reranker_project_finetuned.pt
```

Role:

```text
Rank normal/core recommendations inside the user's main interests.
```

Training path:

```text
balanced arXiv training
-> fine-tuning on Thinklist live arXiv corpus
```

Use it for:

- AI/ML papers for users interested in AI/ML;
- math papers for users interested in math;
- close, directly relevant recommendations.

### Cross-Domain Boost Model

Artifact:

```text
cross_domain_boosted_reranker.pt
```

Role:

```text
Rank adjacent-domain candidates that may expand the user's scientific horizon.
```

Training path:

```text
targeted cross-domain arXiv subset
AI/ML + neuroscience/biology + statistics/optimization + signal/data + math bridges
```

Use it for:

- neuroscience papers for AI users;
- statistics/optimization papers for ML users;
- signal processing / scientific data-analysis papers for CS users;
- other adjacent scientific bridges.

## Runtime Architecture

Recommended runtime split:

```text
frontend
  -> backend-api /feed
      -> PostgreSQL: user profile, events, papers, tags
      -> ml-service /ml/rank
          -> in-memory article embeddings
          -> project fine-tuned reranker
          -> cross-domain boost reranker
          -> feed mix policy
      -> backend-api returns final articles
```

The backend should not run neural inference directly. It should keep model logic inside `ml-service`.

## Artifact Layout

Recommended repository/runtime layout:

```text
ml-service/
  app/
    services/
      recommender.py
      neural_artifacts.py
      neural_features.py
      domain_discovery.py
  artifacts/
    project/
      discovery_reranker_project_finetuned.pt
      feature_scaler.npz
    cross_domain/
      cross_domain_boosted_reranker.pt
      cross_domain_feature_scaler.npz
    embeddings/
      article_embeddings.npy
      article_metadata.jsonl
```

For the current diploma MVP, file-based artifacts are enough.

Future production improvement:

```text
paper_embeddings table in PostgreSQL
```

## Recommended Tech Stack

Training:

- Google Colab with T4 GPU
- Python
- PyTorch
- SentenceTransformers
- scikit-learn
- pandas / numpy
- matplotlib / seaborn for metrics and thesis figures

Runtime:

- FastAPI ML-service
- PyTorch CPU inference
- NumPy
- scikit-learn `StandardScaler` parameters loaded from `.npz`
- PostgreSQL for papers, tags, events, collections
- Docker Compose for local demo

Do not require GPU for backend inference.

## Rebuild Flow

`POST /ml/rebuild` should become responsible for building the runtime recommendation index.

Recommended behavior:

1. Fetch papers with tags from PostgreSQL.
2. Build or refresh article texts:

```text
title + abstract + tags
```

3. Compute SentenceTransformer embeddings for all articles.
4. Normalize embeddings.
5. Save or cache:

```text
paper_id -> embedding row
paper_id -> tags
paper_id -> domain
paper_id -> focus group
paper_id -> published_at
```

6. Load model artifacts:

```text
project fine-tuned MLP
cross-domain boosted MLP
feature scaler(s)
```

7. Return rebuild stats:

```json
{
  "status": "ok",
  "documents": 5000,
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "project_model_loaded": true,
  "cross_domain_model_loaded": true,
  "embedding_dimensions": 384
}
```

## Request-Time Ranking Flow

At request time, do not recompute all article embeddings.

For authenticated users:

1. Backend reads:

```text
user interests
liked papers
saved papers
hidden papers
```

2. Backend or ML-service builds a user profile:

```text
mean embedding of liked/saved papers
+ optional interest tag vector/features
```

3. Candidate generation splits articles into two pools:

```text
core_candidates
adjacent_candidates
```

4. `project_finetuned_model` scores `core_candidates`.
5. `cross_domain_boost_model` scores `adjacent_candidates`.
6. ML-service mixes final feed:

```text
default: 80% core, 20% adjacent
explore mode: 70% core, 30% adjacent
```

7. ML-service returns ranked IDs and explanations.

## Candidate Pool Rules

### Core Candidates

Core candidates should match at least one of:

- user's selected interests;
- tags from liked/saved papers;
- same scientific domain as the user profile;
- high embedding cosine similarity.

### Adjacent Candidates

Adjacent candidates should satisfy:

- not the same primary focus group as the user;
- belongs to an adjacent allowed focus group;
- has enough semantic similarity to the user embedding;
- not hidden by the user;
- not already shown too often.

Example focus bridge:

```text
ai_core -> neuro_bio
ai_core -> stats_optimization
ai_core -> signal_data
ai_core -> math_bridge
```

## Feed Mix Policy

Use explicit controlled injection. Do not rely on natural top-k ranking to surface adjacent papers.

Default:

```text
top 10 feed:
8 core recommendations
2 adjacent recommendations
```

Exploration mode:

```text
top 10 feed:
7 core recommendations
3 adjacent recommendations
```

Reason:

Core recommendations are usually more directly relevant and will dominate pure score sorting. Controlled injection guarantees scientific discovery without sacrificing precision.

## Proposed API Shape

Endpoint:

```text
POST /ml/rank
```

Request:

```json
{
  "user_id": 1,
  "positive_paper_ids": [10, 25, 31],
  "candidate_paper_ids": [1, 2, 3, 4],
  "user_interests": ["cs.AI", "cs.LG"],
  "hidden_paper_ids": [9],
  "exploration_ratio": 0.2,
  "mode": "hybrid"
}
```

Recommended response:

```json
{
  "ranked": [
    {
      "paper_id": 42,
      "score": 0.91,
      "bucket": "core",
      "domain": "computer_science",
      "model": "project_finetuned",
      "scores": {
        "neural": 0.91,
        "cosine": 0.77,
        "tag_overlap": 0.42,
        "freshness": 1.0
      },
      "reasons": [
        "Matches your selected interests",
        "Similar to saved papers"
      ]
    },
    {
      "paper_id": 77,
      "score": 0.84,
      "bucket": "adjacent",
      "domain": "neuroscience_biology",
      "model": "cross_domain_boost",
      "scores": {
        "neural": 0.84,
        "cosine": 0.61,
        "bridge": 0.35,
        "novelty": 0.88
      },
      "reasons": [
        "Adjacent field: neuroscience biology",
        "Semantically close to saved AI papers"
      ]
    }
  ],
  "mix": {
    "core": 8,
    "adjacent": 2,
    "exploration_ratio": 0.2
  }
}
```

## Performance Expectations

For 5,000 papers:

```text
Embeddings memory: about 8 MB
MLP models: about 1-3 MB each
SentenceTransformer runtime memory: about 100-300 MB
```

Recommended local demo runtime:

```text
CPU: 4 cores
RAM: 8 GB
GPU: not required for inference
```

Expected timings if embeddings are precomputed:

```text
ML rebuild on CPU: 1-5 minutes
Core ranking: 10-40 ms
Adjacent ranking: 10-40 ms
Full /feed with DB/API overhead: about 100-300 ms
```

Do not compute SentenceTransformer embeddings for all papers during `/feed`.

## Integration Tasks

### Phase 1: Artifact Loading

Files likely touched:

```text
ml-service/requirements.txt
ml-service/app/services/neural_artifacts.py
ml-service/app/services/recommender.py
ml-service/app/main.py
```

Tasks:

- add PyTorch and SentenceTransformers runtime dependencies;
- create artifact loader;
- validate model input dimensions;
- expose health fields for loaded models.

### Phase 2: Embedding Index

Files likely touched:

```text
ml-service/app/db/session.py
ml-service/app/services/neural_features.py
ml-service/app/services/recommender.py
```

Tasks:

- fetch `id`, `title`, `abstract`, `tags`, `published_at`;
- compute article embeddings during rebuild;
- keep `paper_id -> embedding` mapping in memory;
- optionally save `article_embeddings.npy` cache.

### Phase 3: Domain And Candidate Splitting

Files likely touched:

```text
ml-service/app/services/domain_discovery.py
ml-service/app/services/domains.py
```

Tasks:

- define focus groups;
- define adjacent focus group rules;
- split candidate IDs into `core` and `adjacent`;
- exclude hidden papers.

### Phase 4: Dual Ranking

Files likely touched:

```text
ml-service/app/services/recommender.py
ml-service/app/main.py
backend-api/app/main.py
```

Tasks:

- score core candidates with project model;
- score adjacent candidates with cross-domain model;
- merge with `exploration_ratio`;
- return model/bucket/reason fields.

### Phase 5: Tests And Evidence

Recommended tests:

```text
tests/test_neural_artifact_contract.py
tests/test_cross_domain_candidate_split.py
tests/test_dual_model_rank_contract.py
tests/test_feed_cross_domain_mix_contract.py
```

Minimum evidence:

- `/ml/rebuild` reports both models loaded;
- `/ml/rank` returns both `core` and `adjacent` buckets when candidates exist;
- adjacent share respects `exploration_ratio`;
- fallback still works if neural artifacts are missing.

## Fallback Rules

If neural artifacts are missing:

```text
Use current TF-IDF/SVD hybrid recommender.
```

If cross-domain model is missing:

```text
Use project model for core ranking and rule-based adjacent scoring.
```

If embeddings are missing:

```text
Return 503 model_not_ready with rebuild instruction,
or fallback to freshness ranking for demo continuity.
```

## Final Recommended Product Behavior

Default feed:

```text
80% direct/core recommendations
20% adjacent cross-domain recommendations
```

User-facing mode idea:

```text
Balanced: 80/20
Explore: 70/30
Focused: 100/0
```

For the diploma MVP, implement only the default `80/20` mode unless extra UI time is available.

## Summary

The backend should integrate the models as a dual-ranker system:

```text
Project Fine-Tuned Model = accuracy and direct relevance
Cross-Domain Boost Model = adjacent scientific discovery
Feed Mix Policy = controlled 80/20 blend
```

This gives Thinklist a clear, defensible recommendation architecture: accurate personal recommendations plus a measurable interdisciplinary discovery mechanism.
