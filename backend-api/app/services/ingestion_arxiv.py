from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import feedparser
import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Paper, Source, Tag, IngestionRun
from app.services.papers import create_or_get_paper

ARXIV_API_URL = "https://export.arxiv.org/api/query"
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
    "astro-ph.CO", "astro-ph.EP", "astro-ph.GA", "astro-ph.HE",
    "astro-ph.IM", "astro-ph.SR",
    "cond-mat.dis-nn", "cond-mat.mes-hall", "cond-mat.mtrl-sci",
    "cond-mat.other", "cond-mat.quant-gas", "cond-mat.soft",
    "cond-mat.stat-mech", "cond-mat.str-el", "cond-mat.supr-con",
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
DEFAULT_ARXIV_TARGET_TOTAL = 5000
DEFAULT_ARXIV_BATCH_SIZE = 100
DEFAULT_ARXIV_INTERVAL_SECONDS = 300
ARXIV_BATCH_SIZE = DEFAULT_ARXIV_BATCH_SIZE
ARXIV_CATEGORY_CHUNK_SIZE = 1
ARXIV_REQUEST_DELAY_SECONDS = 3.0
ARXIV_RETRY_DELAYS_SECONDS = (15.0, 30.0, 60.0)


def _build_query(categories: List[str]) -> str:
    """
    Формирует search_query для arXiv API (httpx сам кодирует пробелы в '+'):
    cat:cs.AI OR cat:cs.CL
    """
    parts = [f"cat:{c}" for c in categories]
    return " OR ".join(parts)


def _chunk_categories(categories: List[str]) -> List[List[str]]:
    return [
        categories[index : index + ARXIV_CATEGORY_CHUNK_SIZE]
        for index in range(0, len(categories), ARXIV_CATEGORY_CHUNK_SIZE)
    ]


def _fetch_arxiv_response(params: Dict[str, Any]) -> Optional[httpx.Response]:
    for retry_delay in (*ARXIV_RETRY_DELAYS_SECONDS, 0.0):
        response = httpx.get(
            ARXIV_API_URL,
            params=params,
            timeout=90.0,
            follow_redirects=True,
            headers={"User-Agent": "SciVisE/0.1 (admin ingestion)"},
        )
        if response.status_code != 429 and response.status_code < 500:
            response.raise_for_status()
            return response

        if retry_delay <= 0:
            return None

        retry_after = response.headers.get("Retry-After")
        delay = retry_delay
        if retry_after:
            try:
                delay = max(delay, float(retry_after))
            except ValueError:
                pass
        time.sleep(delay)

    return None


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

    arXiv API стабильнее отдаёт крупные выборки частями, поэтому для 5000
    статей идём батчами и дедуплицируем записи по id.
    """
    entries: List[Any] = []
    seen_ids: set[str] = set()
    category_chunks = _chunk_categories(categories)
    chunk_limit = max(1, min(ARXIV_BATCH_SIZE, (limit + len(category_chunks) - 1) // len(category_chunks)))

    for category_chunk in category_chunks:
        query = _build_query(category_chunk)

        for start in range(0, chunk_limit, ARXIV_BATCH_SIZE):
            batch_limit = min(ARXIV_BATCH_SIZE, chunk_limit - start, limit - len(entries))
            if batch_limit <= 0:
                break

            params = {
                "search_query": query,
                "start": start,
                "max_results": batch_limit,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
            }

            response = _fetch_arxiv_response(params)
            if response is None:
                break

            feed = feedparser.parse(response.text)
            batch = feed.entries or []
            if not batch:
                break

            for entry in batch:
                entry_id = str(getattr(entry, "id", "") or "")
                if entry_id and entry_id in seen_ids:
                    continue
                if entry_id:
                    seen_ids.add(entry_id)
                entries.append(entry)
                if len(entries) >= limit:
                    break

            if len(batch) < batch_limit or len(entries) >= limit:
                break

            time.sleep(ARXIV_REQUEST_DELAY_SECONDS)

        if len(entries) >= limit:
            break

        time.sleep(ARXIV_REQUEST_DELAY_SECONDS)

    return entries[:limit]


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


def get_arxiv_source(db: Session) -> Source:
    source: Optional[Source] = (
        db.query(Source)
        .filter(Source.code == "arxiv", Source.type == "arxiv", Source.enabled.is_(True))
        .one_or_none()
    )
    if not source:
        raise RuntimeError("arXiv source is not configured in sources table")
    return source


def count_arxiv_papers(db: Session, source: Source | None = None) -> int:
    query = db.query(Paper)
    if source is not None:
        query = query.filter(Paper.source_id == source.id)
    else:
        query = query.join(Source, Paper.source_id == Source.id).filter(
            Source.code == "arxiv"
        )
    return query.count()


def _source_ingestion_config(source: Source) -> dict[str, Any]:
    config: dict[str, Any] = source.config or {}
    cursor = config.get("cursor") or {"category_index": 0, "start": 0}
    return {
        "categories": config.get("categories") or DEFAULT_ARXIV_CATEGORIES,
        "target_total": int(
            config.get("target_total")
            or config.get("limit")
            or DEFAULT_ARXIV_TARGET_TOTAL
        ),
        "batch_size": int(config.get("batch_size") or DEFAULT_ARXIV_BATCH_SIZE),
        "interval_seconds": int(
            config.get("interval_seconds") or DEFAULT_ARXIV_INTERVAL_SECONDS
        ),
        "cursor": {
            "category_index": int(cursor.get("category_index", 0)),
            "start": int(cursor.get("start", 0)),
        },
    }


def _save_cursor(source: Source, db: Session, category_index: int, start: int) -> None:
    config = dict(source.config or {})
    config["cursor"] = {"category_index": category_index, "start": start}
    source.config = config
    db.add(source)
    db.commit()


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

    return list(entries or []), {
        "category_index": next_category_index,
        "start": next_start,
    }


def run_arxiv_ingestion_batch(
    db: Session,
    batch_size: int | None = None,
    target_total: int | None = None,
) -> Dict[str, Any]:
    source = get_arxiv_source(db)
    config = _source_ingestion_config(source)
    categories = config["categories"]
    effective_batch_size = min(
        batch_size or config["batch_size"],
        DEFAULT_ARXIV_BATCH_SIZE,
    )
    effective_target_total = target_total or config["target_total"]
    current_total = count_arxiv_papers(db, source)
    if current_total >= effective_target_total:
        return {
            "source": "arxiv",
            "categories": categories,
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
            db.rollback()
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
    _save_cursor(source, db, next_cursor["category_index"], next_cursor["start"])

    current_total = count_arxiv_papers(db, source)

    return {
        "source": "arxiv",
        "categories": categories,
        "batch_size": effective_batch_size,
        "target_total": effective_target_total,
        "current_total": current_total,
        "target_reached": current_total >= effective_target_total,
        "cursor": next_cursor,
        "fetched": len(entries),
        "added": added,
        "skipped": skipped,
        "failed": failed,
    }


def run_arxiv_ingestion(db: Session) -> Dict[str, Any]:
    return run_arxiv_ingestion_batch(db)
