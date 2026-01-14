from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class ModelState:
    vectorizer: TfidfVectorizer | None = None
    matrix: Any | None = None
    paper_ids: list[int] = field(default_factory=list)
    id_to_index: dict[int, int] = field(default_factory=dict)
    built_at: datetime | None = None


STATE = ModelState()


def rebuild_index(rows: Iterable[tuple[int, str, str | None]]) -> dict:
    documents: list[str] = []
    paper_ids: list[int] = []

    for paper_id, title, abstract in rows:
        if not title:
            continue
        text = title
        if abstract:
            text = f"{text}\n{abstract}"
        documents.append(text)
        paper_ids.append(paper_id)

    built_at = datetime.now(timezone.utc)
    if not documents:
        STATE.vectorizer = None
        STATE.matrix = None
        STATE.paper_ids = []
        STATE.id_to_index = {}
        STATE.built_at = built_at
        return {
            "documents": 0,
            "vocab_size": 0,
            "built_at": built_at,
        }

    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform(documents)

    STATE.vectorizer = vectorizer
    STATE.matrix = matrix
    STATE.paper_ids = paper_ids
    STATE.id_to_index = {paper_id: idx for idx, paper_id in enumerate(paper_ids)}
    STATE.built_at = built_at

    return {
        "documents": len(documents),
        "vocab_size": len(vectorizer.vocabulary_),
        "built_at": built_at,
    }


def rank_candidates(
    positive_ids: list[int], candidate_ids: list[int]
) -> list[tuple[int, float]]:
    if STATE.matrix is None or not STATE.paper_ids:
        raise RuntimeError("model_not_ready")

    id_to_index = STATE.id_to_index
    positive_indices = [id_to_index[p] for p in positive_ids if p in id_to_index]
    if not positive_indices:
        return []

    seen: set[int] = set()
    candidate_indices: list[int] = []
    candidate_unique: list[int] = []
    for candidate_id in candidate_ids:
        if candidate_id in seen:
            continue
        seen.add(candidate_id)
        index = id_to_index.get(candidate_id)
        if index is None:
            continue
        candidate_unique.append(candidate_id)
        candidate_indices.append(index)

    if not candidate_indices:
        return []

    profile = STATE.matrix[positive_indices].mean(axis=0)
    profile_array = profile.A if hasattr(profile, "A") else np.asarray(profile)
    scores = cosine_similarity(
        STATE.matrix[candidate_indices], profile_array
    ).ravel()

    ranked = sorted(
        zip(candidate_unique, scores, strict=False),
        key=lambda item: (-item[1], item[0]),
    )
    return [(paper_id, float(score)) for paper_id, score in ranked]
