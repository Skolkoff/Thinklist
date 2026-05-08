# Hybrid Neural Recommendation System

Date: 2026-05-08

## Purpose

This artifact captures the recommendation-system direction for the diploma report and for implementation before Phase 4.

Target thesis framing:

> A hybrid recommendation system for scientific publications that combines classical text similarity, dense latent semantic representations, a lightweight neural reranker, user interests, behavioral feedback, freshness, diversity, and cross-domain discovery.

## Current MVP Recommender

The current system is a content-based baseline.

### Stack

- Backend: FastAPI, SQLAlchemy, PostgreSQL.
- ML service: FastAPI, scikit-learn.
- Text model: `TfidfVectorizer(stop_words="english")`.
- Ranking: cosine similarity.
- User signals:
  - `LIKE`
  - `SAVE`
  - `HIDE`
- User profile:
  - onboarding interests from `user_interests`
  - positive papers from liked/saved articles
- Index:
  - in-memory TF-IDF matrix rebuilt on ML-service startup
  - manual rebuild through `POST /ml/rebuild`

### Current Flow

1. User opens `/feed`.
2. Backend checks whether the user is authenticated.
3. Guest feed returns recent papers sorted by `published_at desc`.
4. Authenticated feed reads user interests.
5. Backend builds a candidate pool from papers matching interest tags.
6. Backend reads positive feedback: liked and saved paper IDs.
7. Backend sends `positive_paper_ids` and `candidate_paper_ids` to `POST /ml/rank`.
8. ML service builds a user TF-IDF profile by averaging positive paper vectors.
9. Candidate papers are ranked by cosine similarity to the user profile.
10. Backend returns the feed in ranked order.
11. If ML is unavailable or the user has no positive signals, backend falls back to freshness ranking.

## Why A Hybrid Neural System

TF-IDF is simple and explainable, but it mostly matches vocabulary. Scientific discovery often needs semantic similarity, method transfer, and adjacent-field exploration. For example, a computer science researcher may find useful ideas in computational biology, physics, neuroscience, statistics, or optimization.

The next system should keep TF-IDF as an explainable baseline and add a lightweight neural reranker. A transformer semantic encoder remains the best future upgrade, but it is intentionally not the MVP dependency because it pulls a heavy Torch stack into Docker.

## Proposed Minimal Stack

- Keep: FastAPI backend, PostgreSQL, SQLAlchemy.
- Keep: ML-service FastAPI boundary.
- Keep: TF-IDF baseline.
- Add: scikit-learn `TruncatedSVD` dense semantic layer over TF-IDF.
- Add: scikit-learn `MLPRegressor` as a lightweight neural reranker over hybrid score features.
- Future scientific upgrade:
  - `sentence-transformers/all-MiniLM-L6-v2` for transformer embeddings
  - SPECTER/SPECTER2 family for scientific-paper embeddings
  - heavier dependency/runtime profile, should be introduced only when Docker/runtime budget allows it
- Store embeddings:
  - MVP: in-memory matrix rebuilt from DB
  - next: PostgreSQL table `paper_embeddings`

## Hybrid Ranking Formula

Initial weighted score:

```text
final_score =
  0.35 * semantic_similarity
+ 0.25 * tfidf_similarity
+ 0.20 * interest_match
+ 0.10 * behavior_boost
+ 0.05 * freshness_score
- 0.05 * diversity_penalty
```

Weights are intentionally simple and documented. They can be tuned after demo evidence.

### Components

#### Dense Semantic Similarity

The MVP transforms `title + abstract` into dense latent semantic vectors through TF-IDF + SVD.

```text
paper_text -> TF-IDF -> TruncatedSVD -> dense semantic vector
```

User semantic profile:

```text
mean(embeddings of liked/saved papers)
```

Candidate semantic score:

```text
cosine(user_embedding, candidate_embedding)
```

#### TF-IDF Similarity

Existing baseline:

```text
cosine(mean(tfidf vectors of liked/saved papers), candidate_tfidf)
```

This is useful for explainability and comparison in the diploma report.

#### Interest Match

Compares article tags with user interests.

Example:

```text
interest_match = matching_user_interest_tags / total_user_interest_tags
```

#### Behavior Boost

Positive behavior signals:

```text
SAVE = 1.0
LIKE = 0.7
COMMENT = 0.5
OPEN = 0.2
```

Current MVP has `SAVE`, `LIKE`, and `HIDE`. `COMMENT` and `OPEN` can be added later.

`HIDE` excludes a paper.

#### Freshness

Recent papers get a small boost. Older papers can still win if semantic relevance is strong.

#### Diversity

The feed should avoid showing only one narrow topic. Diversity can penalize repeated tags/authors/domains in the final ordering.

## Cross-Domain Discovery

Scientific recommendations should include adjacent fields, not only close matches.

The system should split the feed into two buckets:

```text
80% core recommendations
20% adjacent recommendations
```

### Core Recommendations

Papers that are close to:

- user interests
- liked/saved papers
- same or nearby arXiv categories

### Adjacent Recommendations

Papers that are semantically close but belong to a different scientific domain.

Good adjacent candidates have:

```text
high semantic similarity + medium domain distance
```

Bad adjacent candidates have:

```text
low semantic similarity + high domain distance
```

### Domain Mapping

MVP domain mapping can be based on arXiv tags:

```text
cs.*        -> computer_science
stat.*      -> statistics
math.*      -> mathematics
q-bio.*     -> biology
physics.*   -> physics
cond-mat.*  -> physics
econ.*      -> economics
q-fin.*     -> finance
```

Example:

User reads graph neural networks in computer science.

Core:

- graph representation learning
- node classification
- recommender systems with GNNs

Adjacent:

- protein interaction networks
- molecular graph generation
- brain connectome analysis
- particle physics graph reconstruction

### Adjacent Score

```text
adjacency_score =
  semantic_similarity * domain_distance * novelty_score
```

Where:

- `semantic_similarity`: neural similarity between user profile and candidate.
- `domain_distance`: candidate is outside the main user domain but not random.
- `novelty_score`: user has not over-consumed this domain.

## Recommended API Shape

Current endpoint can be extended:

```text
POST /ml/rank
```

Suggested payload:

```json
{
  "user_id": 1,
  "positive_paper_ids": [1, 7, 14],
  "candidate_paper_ids": [2, 3, 4, 5],
  "user_interests": ["cs.LG", "cs.AI"],
  "hidden_paper_ids": [9],
  "exploration_ratio": 0.2
}
```

Suggested response:

```json
{
  "ranked": [
    {
      "paper_id": 4,
      "score": 0.82,
      "bucket": "core",
      "scores": {
        "semantic": 0.77,
        "tfidf": 0.64,
        "interest": 1.0,
        "freshness": 0.9
      },
      "reasons": [
        "Matches your interests in cs.LG",
        "Similar to saved papers"
      ]
    },
    {
      "paper_id": 12,
      "score": 0.71,
      "bucket": "adjacent",
      "domain": "biology",
      "scores": {
        "semantic": 0.74,
        "tfidf": 0.38,
        "interest": 0.0,
        "freshness": 0.8
      },
      "reasons": [
        "Adjacent field: Biology",
        "Semantically close to saved papers"
      ]
    }
  ]
}
```

## UI Ideas

Minimal UI can show small badges:

- `Recommended`
- `Adjacent field`
- `Cross-domain idea`

Example explanation:

> Similar to your saved papers on graph neural networks, but from computational biology.

## Implementation Strategy

Do not replace the current recommender in one large rewrite.

Recommended path:

1. Document current baseline.
2. Add neural embedding index beside TF-IDF.
3. Add hybrid scoring.
4. Add domain mapping and adjacent bucket.
5. Return reasons and component scores.
6. Add smoke/demo evidence.
7. Later: persist embeddings and tune weights.

## Diploma Value

This approach is defensible because it includes:

- classical baseline: TF-IDF
- dense semantic layer and neural MLP reranker
- transformer embeddings documented as the next upgrade path
- hybrid ranking formula
- user interest modeling
- behavioral feedback loop
- cross-domain discovery mechanism
- explainability through score components and reasons
- measurable demo scenario before/after user actions

## Implementation Evidence

Final verification on 2026-05-08:

- Unit/static tests: `21/21` passed.
- Frontend build: `npm run build` passed.
- Docker rebuild: `docker compose build` passed.
- Services after rebuild: backend and ML healthy.
- API smoke: `12/12` passed with hybrid rank.
- Hybrid rank response includes score components:
  - `semantic`
  - `tfidf`
  - `interest`
  - `behavior`
  - `freshness`
  - `diversity_penalty`
  - `neural`
- Browser QA: first load console had `0 Errors, 0 Warnings`.
- Screenshot artifact: `output/playwright/hybrid-recommender-feed.png`.
#### Neural Reranker

The neural part of the MVP is a small `MLPRegressor` over score features:

```text
[
  semantic_similarity,
  tfidf_similarity,
  interest_match,
  behavior_boost,
  freshness_score,
  diversity_penalty,
  is_adjacent
] -> MLPRegressor -> neural_score
```

The final score blends the transparent formula with the neural score:

```text
final_score = 0.85 * formula_score + 0.15 * neural_score
```

This keeps the system explainable for the diploma while adding a real neural network into the ranking pipeline.
