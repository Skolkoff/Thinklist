from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import normalize

from app.services.domains import domains_for_tags, is_adjacent_domain

MODEL_NAME = "tfidf-svd-mlp-reranker"
CORE_RATIO_DEFAULT = 0.8


@dataclass
class PaperMeta:
    paper_id: int
    title: str
    abstract: str | None = None
    published_at: datetime | None = None
    tags: list[str] = field(default_factory=list)


@dataclass
class ModelState:
    vectorizer: TfidfVectorizer | None = None
    matrix: Any | None = None
    neural_reranker: Any | None = None
    semantic_matrix: Any | None = None
    paper_ids: list[int] = field(default_factory=list)
    id_to_index: dict[int, int] = field(default_factory=dict)
    paper_meta: dict[int, PaperMeta] = field(default_factory=dict)
    paper_tags: dict[int, list[str]] = field(default_factory=dict)
    built_at: datetime | None = None
    semantic_backend: str = "unavailable"


@dataclass(frozen=True)
class RankedPaper:
    paper_id: int
    score: float
    bucket: str
    domain: str | None
    scores: dict[str, float]
    reasons: list[str]


STATE = ModelState()


def _normalize_row(row: Any) -> PaperMeta:
    if isinstance(row, dict):
        return PaperMeta(
            paper_id=int(row["id"]),
            title=row["title"],
            abstract=row.get("abstract"),
            published_at=row.get("published_at"),
            tags=list(row.get("tags") or []),
        )
    paper_id, title, abstract = row
    return PaperMeta(paper_id=int(paper_id), title=title, abstract=abstract)


def _paper_text(meta: PaperMeta) -> str:
    if meta.abstract:
        return f"{meta.title}\n{meta.abstract}"
    return meta.title


def _build_semantic_matrix(tfidf_matrix: Any) -> Any:
    max_components = min(64, max(2, tfidf_matrix.shape[0] - 1), max(2, tfidf_matrix.shape[1] - 1))
    if max_components < 2:
        return tfidf_matrix
    svd = TruncatedSVD(n_components=max_components, random_state=42)
    dense = svd.fit_transform(tfidf_matrix)
    return normalize(dense)


def rebuild_index(rows: Iterable[Any]) -> dict:
    documents: list[str] = []
    paper_ids: list[int] = []
    paper_meta: dict[int, PaperMeta] = {}
    paper_tags: dict[int, list[str]] = {}

    for row in rows:
        meta = _normalize_row(row)
        if not meta.title:
            continue
        documents.append(_paper_text(meta))
        paper_ids.append(meta.paper_id)
        paper_meta[meta.paper_id] = meta
        paper_tags[meta.paper_id] = meta.tags

    built_at = datetime.now(timezone.utc)
    if not documents:
        STATE.vectorizer = None
        STATE.matrix = None
        STATE.semantic_matrix = None
        STATE.paper_ids = []
        STATE.id_to_index = {}
        STATE.paper_meta = {}
        STATE.paper_tags = {}
        STATE.built_at = built_at
        STATE.semantic_backend = "empty"
        STATE.neural_reranker = None
        return {
            "documents": 0,
            "vocab_size": 0,
            "built_at": built_at,
            "embedding_model": MODEL_NAME,
            "semantic_backend": STATE.semantic_backend,
            "semantic_dimensions": 0,
        }

    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform(documents)

    semantic_backend = "tfidf-svd"
    semantic_matrix: Any
    try:
        semantic_matrix = _build_semantic_matrix(matrix)
    except Exception:
        semantic_backend = "tfidf-fallback"
        semantic_matrix = matrix

    STATE.vectorizer = vectorizer
    STATE.matrix = matrix
    STATE.semantic_matrix = semantic_matrix
    STATE.paper_ids = paper_ids
    STATE.id_to_index = {paper_id: idx for idx, paper_id in enumerate(paper_ids)}
    STATE.paper_meta = paper_meta
    STATE.paper_tags = paper_tags
    STATE.built_at = built_at
    STATE.semantic_backend = semantic_backend
    STATE.neural_reranker = MLPRegressor(
        hidden_layer_sizes=(8,),
        activation="relu",
        solver="lbfgs",
        max_iter=500,
        random_state=42,
    )

    semantic_dimensions = (
        int(semantic_matrix.shape[1])
        if hasattr(semantic_matrix, "shape") and len(semantic_matrix.shape) > 1
        else 0
    )
    return {
        "documents": len(documents),
        "vocab_size": len(vectorizer.vocabulary_),
        "built_at": built_at,
        "embedding_model": MODEL_NAME,
        "semantic_backend": semantic_backend,
        "semantic_dimensions": semantic_dimensions,
    }


def _indices_for(ids: list[int]) -> list[int]:
    return [STATE.id_to_index[paper_id] for paper_id in ids if paper_id in STATE.id_to_index]


def _dedupe_candidates(candidate_ids: list[int], hidden_ids: set[int]) -> list[int]:
    seen: set[int] = set()
    result: list[int] = []
    for candidate_id in candidate_ids:
        if candidate_id in seen or candidate_id in hidden_ids:
            continue
        if candidate_id not in STATE.id_to_index:
            continue
        seen.add(candidate_id)
        result.append(candidate_id)
    return result


def _cosine_scores(matrix: Any, positive_indices: list[int], candidate_indices: list[int]) -> np.ndarray:
    if not positive_indices or not candidate_indices:
        return np.zeros(len(candidate_indices), dtype=float)
    profile = matrix[positive_indices].mean(axis=0)
    profile_array = profile.A if hasattr(profile, "A") else np.asarray(profile)
    return cosine_similarity(matrix[candidate_indices], profile_array).ravel()


def _semantic_scores(positive_indices: list[int], candidate_indices: list[int]) -> np.ndarray:
    if STATE.semantic_matrix is None or not positive_indices or not candidate_indices:
        return np.zeros(len(candidate_indices), dtype=float)
    matrix = STATE.semantic_matrix
    if hasattr(matrix, "tocsr"):
        return _cosine_scores(matrix, positive_indices, candidate_indices)
    semantic = np.asarray(matrix)
    profile = semantic[positive_indices].mean(axis=0, keepdims=True)
    return cosine_similarity(semantic[candidate_indices], profile).ravel()


def _interest_match(user_interests: list[str], tags: list[str]) -> float:
    normalized_interests = {tag.strip().lower() for tag in user_interests if tag.strip()}
    normalized_tags = {tag.strip().lower() for tag in tags if tag.strip()}
    if not normalized_interests or not normalized_tags:
        return 0.0
    return len(normalized_interests.intersection(normalized_tags)) / len(normalized_interests)


def _freshness_score(meta: PaperMeta) -> float:
    if not meta.published_at:
        return 0.2
    now = datetime.now(timezone.utc)
    published = meta.published_at
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    age_days = max(0, (now - published).days)
    if age_days <= 30:
        return 1.0
    if age_days <= 180:
        return 0.7
    if age_days <= 730:
        return 0.45
    return 0.2


def _primary_domain(tags: list[str]) -> str | None:
    domains = sorted(domains_for_tags(tags))
    if not domains:
        return None
    if "other" in domains and len(domains) > 1:
        domains.remove("other")
    return domains[0]


def _reasons(
    bucket: str,
    meta: PaperMeta,
    semantic_similarity: float,
    tfidf_similarity: float,
    interest_score: float,
) -> list[str]:
    reasons: list[str] = []
    if bucket == "adjacent":
        domain = _primary_domain(meta.tags)
        if domain:
            reasons.append(f"Adjacent field: {domain.replace('_', ' ').title()}")
        reasons.append("Semantically close to saved papers")
    else:
        if interest_score > 0:
            reasons.append("Matches your selected interests")
        if semantic_similarity >= 0.35:
            reasons.append("Similar to saved papers")
        elif tfidf_similarity >= 0.25:
            reasons.append("Shares key terms with saved papers")
    if _freshness_score(meta) >= 0.7:
        reasons.append("Recent publication")
    return reasons or ["Ranked by hybrid relevance"]


def _interleave_adjacent(items: list[RankedPaper], exploration_ratio: float) -> list[RankedPaper]:
    core = [item for item in items if item.bucket == "core"]
    adjacent = [item for item in items if item.bucket == "adjacent"]
    if not adjacent or exploration_ratio <= 0:
        return core + adjacent

    interval = max(2, round(1 / max(0.05, exploration_ratio)))
    result: list[RankedPaper] = []
    adjacent_index = 0
    for index, item in enumerate(core, start=1):
        result.append(item)
        if index % interval == 0 and adjacent_index < len(adjacent):
            result.append(adjacent[adjacent_index])
            adjacent_index += 1
    result.extend(adjacent[adjacent_index:])
    return result


def _neural_scores(features: np.ndarray, baseline: np.ndarray) -> np.ndarray:
    if features.shape[0] < 3 or STATE.neural_reranker is None:
        return baseline
    try:
        STATE.neural_reranker.fit(features, baseline)
        predicted = STATE.neural_reranker.predict(features)
    except Exception:
        return baseline
    return np.clip(predicted, 0.0, 1.0)


def rank_candidates_hybrid(
    positive_ids: list[int],
    candidate_ids: list[int],
    user_interests: list[str],
    hidden_ids: list[int] | None = None,
    exploration_ratio: float = 0.2,
) -> list[RankedPaper]:
    if STATE.matrix is None or STATE.semantic_matrix is None or not STATE.paper_ids:
        raise RuntimeError("model_not_ready")

    hidden = set(hidden_ids or [])
    positive_indices = _indices_for(positive_ids)
    candidates = _dedupe_candidates(candidate_ids, hidden)
    candidate_indices = _indices_for(candidates)
    if not candidates:
        return []

    tfidf_scores = _cosine_scores(STATE.matrix, positive_indices, candidate_indices)
    semantic_scores = _semantic_scores(positive_indices, candidate_indices)
    user_domains = domains_for_tags(user_interests)

    feature_rows: list[list[float]] = []
    baseline_scores: list[float] = []
    raw_items: list[tuple[int, PaperMeta, str, str | None, float, float, float, float, float]] = []
    for position, paper_id in enumerate(candidates):
        meta = STATE.paper_meta[paper_id]
        semantic_similarity = float(semantic_scores[position]) if len(semantic_scores) else 0.0
        tfidf_similarity = float(tfidf_scores[position]) if len(tfidf_scores) else 0.0
        interest_score = _interest_match(user_interests, meta.tags)
        freshness = _freshness_score(meta)
        behavior_boost = 1.0 if paper_id in positive_ids else 0.0
        candidate_domains = domains_for_tags(meta.tags)
        adjacent = is_adjacent_domain(user_domains, candidate_domains, semantic_similarity)
        bucket = "adjacent" if adjacent else "core"
        diversity_penalty = 0.05 if bucket == "core" and interest_score == 0 and user_interests else 0.0

        baseline_score = (
            0.35 * semantic_similarity
            + 0.25 * tfidf_similarity
            + 0.20 * interest_score
            + 0.10 * behavior_boost
            + 0.05 * freshness
            - 0.05 * diversity_penalty
        )
        feature_rows.append(
            [
                semantic_similarity,
                tfidf_similarity,
                interest_score,
                behavior_boost,
                freshness,
                diversity_penalty,
                1.0 if bucket == "adjacent" else 0.0,
            ]
        )
        baseline_scores.append(float(baseline_score))
        raw_items.append(
            (
                paper_id,
                meta,
                bucket,
                _primary_domain(meta.tags),
                semantic_similarity,
                tfidf_similarity,
                interest_score,
                behavior_boost,
                freshness,
            )
        )

    neural_scores = _neural_scores(np.asarray(feature_rows), np.asarray(baseline_scores))

    ranked: list[RankedPaper] = []
    for index, raw in enumerate(raw_items):
        (
            paper_id,
            meta,
            bucket,
            domain,
            semantic_similarity,
            tfidf_similarity,
            interest_score,
            behavior_boost,
            freshness,
        ) = raw
        diversity_penalty = feature_rows[index][5]
        neural_score = float(neural_scores[index])
        final_score = 0.85 * baseline_scores[index] + 0.15 * neural_score
        scores = {
            "semantic": round(semantic_similarity, 6),
            "tfidf": round(tfidf_similarity, 6),
            "interest": round(interest_score, 6),
            "behavior": round(behavior_boost, 6),
            "freshness": round(freshness, 6),
            "diversity_penalty": round(diversity_penalty, 6),
            "neural": round(neural_score, 6),
        }
        ranked.append(
            RankedPaper(
                paper_id=paper_id,
                score=round(float(final_score), 6),
                bucket=bucket,
                domain=domain,
                scores=scores,
                reasons=_reasons(
                    bucket=bucket,
                    meta=meta,
                    semantic_similarity=semantic_similarity,
                    tfidf_similarity=tfidf_similarity,
                    interest_score=interest_score,
                ),
            )
        )

    ranked.sort(key=lambda item: (-item.score, item.paper_id))
    return _interleave_adjacent(ranked, exploration_ratio)


def rank_candidates(
    positive_ids: list[int], candidate_ids: list[int]
) -> list[tuple[int, float]]:
    ranked = rank_candidates_hybrid(
        positive_ids=positive_ids,
        candidate_ids=candidate_ids,
        user_interests=[],
        hidden_ids=[],
        exploration_ratio=0,
    )
    return [(item.paper_id, float(item.score)) for item in ranked]
