from __future__ import annotations

import hashlib
import unicodedata
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Paper


def _normalize_title(title: str) -> str:
    text = unicodedata.normalize("NFKC", title).strip().lower()
    return " ".join(text.split())


def _extract_first_author(authors: Optional[str]) -> str:
    if not authors:
        return ""
    # Ожидаемый формат: "Last, First; Second, Third; ..."
    first = authors.split(";")[0].strip()
    return first.lower()


def _extract_year(published_at) -> str:
    if not published_at:
        return ""
    return str(published_at.year)


def compute_content_hash(
    title: str,
    authors: Optional[str],
    published_at,
) -> str:
    """
    content_hash = hash(title_normalized + first_author + year)
    Соответствует AGENTS.md §5.2.
    """
    title_norm = _normalize_title(title)
    first_author = _extract_first_author(authors)
    year = _extract_year(published_at)

    raw = f"{title_norm}|{first_author}|{year}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_existing_paper_by_dedup_keys(
    db: Session,
    *,
    doi: Optional[str],
    url: Optional[str],
    content_hash: str,
) -> Optional[Paper]:
    """
    Поиск существующей статьи по ключам дедупликации в строгом порядке:
    1) DOI
    2) content_hash
    3) URL
    """
    # 1) DOI — если есть
    if doi:
        stmt = select(Paper).where(Paper.doi == doi)
        existing = db.execute(stmt).scalars().first()
        if existing:
            return existing

    # 2) content_hash
    stmt = select(Paper).where(Paper.content_hash == content_hash)
    existing = db.execute(stmt).scalars().first()
    if existing:
        return existing

    # 3) URL — если есть
    if url:
        stmt = select(Paper).where(Paper.url == url)
        existing = db.execute(stmt).scalars().first()
        if existing:
            return existing

    return None


def create_or_get_paper(
    db: Session,
    *,
    source_id: Optional[int],
    external_id: Optional[str],
    title: str,
    abstract: Optional[str],
    authors: Optional[str],
    published_at,
    doi: Optional[str],
    url: Optional[str],
) -> tuple[Paper, bool]:
    """
    Пытается вставить новую запись в papers, обрабатывая конфликты дедупликации.

    Поведение:
    - если запись с тем же DOI / URL / content_hash уже существует — возвращаем её;
    - если конфликт произошёл на уровне БД (IntegrityError) — повторно читаем существующую и возвращаем.
    """
    content_hash = compute_content_hash(title=title, authors=authors, published_at=published_at)

    existing = get_existing_paper_by_dedup_keys(
        db,
        doi=doi,
        url=url,
        content_hash=content_hash,
    )
    if existing:
        return existing, False

    paper = Paper(
        source_id=source_id,
        external_id=external_id,
        title=title,
        abstract=abstract,
        authors=authors,
        published_at=published_at,
        doi=doi,
        url=url,
        content_hash=content_hash,
    )

    db.add(paper)
    try:
        db.commit()
    except IntegrityError:
        # Конфликт уникальности (doi / url / content_hash) — считаем дубликатом
        db.rollback()
        existing = get_existing_paper_by_dedup_keys(
            db,
            doi=doi,
            url=url,
            content_hash=content_hash,
        )
        if not existing:
            # Если по каким-то причинам запись не найдена, пробрасываем ошибку
            raise
        return existing, False

    db.refresh(paper)
    return paper, True


