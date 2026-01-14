from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import feedparser
import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Paper, Source, Tag, IngestionRun
from app.services.papers import create_or_get_paper

ARXIV_API_URL = "https://export.arxiv.org/api/query"


def _build_query(categories: List[str]) -> str:
    """
    Формирует search_query для arXiv API (httpx сам кодирует пробелы в '+'):
    cat:cs.AI OR cat:cs.CL
    """
    parts = [f"cat:{c}" for c in categories]
    return " OR ".join(parts)


def _parse_published(value: str) -> Optional[datetime]:
    try:
        # Формат arXiv: 2024-01-01T12:34:56Z
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


def _extract_doi(entry: Any) -> Optional[str]:
    # В arXiv Atom DOI может быть в arxiv:doi или в links
    doi = getattr(entry, "arxiv_doi", None)
    if doi:
        return str(doi)

    for link in getattr(entry, "links", []) or []:
        if link.get("title") == "doi":
            return link.get("href")
    return None


def fetch_arxiv_entries(categories: List[str], limit: int) -> List[Any]:
    """
    Запрашивает статьи из arXiv API по категориям.
    """
    query = _build_query(categories)
    params = {
        "search_query": query,
        "start": 0,
        "max_results": limit,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }

    response = httpx.get(
        ARXIV_API_URL,
        params=params,
        timeout=30.0,
        follow_redirects=True,
        headers={"User-Agent": "SciVisE/0.1 (admin ingestion)"},
    )
    response.raise_for_status()

    feed = feedparser.parse(response.text)
    return feed.entries or []


def normalize_entry(entry: Any) -> Dict[str, Any]:
    """
    Нормализует поля arXiv-статьи под модель Paper.
    Без дедупликации и тегов.
    """
    title = getattr(entry, "title", "").strip()
    abstract = getattr(entry, "summary", "").strip() or None

    # Авторы: склеиваем в одну строку "Last, First; ..."
    authors_list = []
    for a in getattr(entry, "authors", []) or []:
        name = a.get("name") if isinstance(a, dict) else getattr(a, "name", None)
        if name:
            authors_list.append(name.strip())
    authors = "; ".join(authors_list) if authors_list else None

    published_raw = getattr(entry, "published", None) or getattr(
        entry, "updated", None
    )
    published_at = _parse_published(published_raw) if published_raw else None

    # URL: основной link с rel="alternate"
    url = None
    for link in getattr(entry, "links", []) or []:
        if link.get("rel") == "alternate":
            url = link.get("href")
            break

    doi = _extract_doi(entry)
    external_id = getattr(entry, "id", None)

    return {
        "external_id": external_id,
        "title": title,
        "abstract": abstract,
        "authors": authors,
        "published_at": published_at,
        "url": url,
        "doi": doi,
    }


def extract_categories(entry: Any) -> List[str]:
    """
    Извлекает категории arXiv из entry.tags (например, 'cs.AI', 'cs.CL').
    """
    categories: List[str] = []
    for t in getattr(entry, "tags", []) or []:
        term = t.get("term") if isinstance(t, dict) else getattr(t, "term", None)
        if term:
            categories.append(term.strip())
    return categories


def _normalize_tag_name(code: str) -> str:
    return code.strip().lower()


def get_or_create_tag(db: Session, category_code: str) -> Tag:
    """
    Создаёт или находит тег по коду категории arXiv.
    tags.normalized_name используется для уникальности.
    """
    normalized = _normalize_tag_name(category_code)

    tag = (
        db.query(Tag)
        .filter(Tag.normalized_name == normalized)
        .one_or_none()
    )
    if tag:
        return tag

    tag = Tag(
        name=category_code,
        slug=normalized,
        normalized_name=normalized,
    )
    db.add(tag)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        tag = (
            db.query(Tag)
            .filter(Tag.normalized_name == normalized)
            .one_or_none()
        )
        if not tag:
            raise
    return tag


def run_arxiv_ingestion(db: Session) -> Dict[str, Any]:
    """
    Ingestion worker для arXiv.

    На этом шаге:
    - используем source `arxiv` из таблицы sources;
    - загружаем статьи по категориям и лимиту из source.config;
    - нормализуем поля и сохраняем в papers;
    - без явной дедупликации и тегов (дубликаты ограничиваются только БД‑констрейнтами).
    """
    source: Optional[Source] = (
        db.query(Source)
        .filter(Source.code == "arxiv", Source.type == "arxiv", Source.enabled.is_(True))
        .one_or_none()
    )
    if not source:
        raise RuntimeError("arXiv source is not configured in sources table")

    config: Dict[str, Any] = source.config or {}
    categories: List[str] = config.get("categories") or ["cs.AI", "cs.CL"]
    limit: int = int(config.get("limit") or 100)

    entries = fetch_arxiv_entries(categories, limit)

    run = IngestionRun(
        source_id=source.id,
    )
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
        except Exception:
            failed += 1
            continue

        # Автотеги из arXiv categories -> tags через paper_tags
        category_codes = extract_categories(entry)
        for code in category_codes:
            tag = get_or_create_tag(db, code)
            if tag not in paper.tags:
                paper.tags.append(tag)

        db.commit()

        if created:
            added += 1
        else:
            skipped += 1

    run.added = added
    run.skipped = skipped
    run.failed = failed
    run.finished_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "source": "arxiv",
        "categories": categories,
        "limit_requested": limit,
        "fetched": len(entries),
        "added": added,
        "skipped": skipped,
        "failed": failed,
    }
