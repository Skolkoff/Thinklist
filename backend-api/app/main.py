from datetime import datetime, timedelta, timezone
import base64
import hashlib
import logging
import secrets

import httpx
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db  # dependency для сессии БД
from app.services.ingestion_arxiv import run_arxiv_ingestion
from app.models import (
    Event,
    EventType,
    IngestionRun,
    Paper,
    Source,
    Tag,
    User,
    UserInterest,
)


settings = get_settings()
logger = logging.getLogger("app.feed")

CANDIDATE_POOL_MIN = 500
CANDIDATE_POOL_MAX = 3000
CANDIDATE_POOL_DEFAULT = 1000

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
)


@app.get("/health")
async def health() -> dict:
    """
    Simple healthcheck endpoint for docker-compose.
    No business logic here, just returns a static status.
    """
    return {"status": "ok"}


@app.get("/version")
async def version() -> dict:
    """
    Возвращает версию backend-api.
    Используется для быстрой проверки, что развёрнута ожидаемая версия.
    """
    return {"version": settings.app_version}


def _parse_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        raw_ts, raw_id = cursor.split("|", 1)
        if raw_ts.endswith("Z"):
            raw_ts = raw_ts[:-1] + "+00:00"
        ts = datetime.fromisoformat(raw_ts)
        return ts, int(raw_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor format") from exc


def _parse_ml_cursor(cursor: str) -> int:
    if not cursor.startswith("ml:"):
        raise HTTPException(status_code=400, detail="Invalid cursor format")
    raw = cursor.removeprefix("ml:")
    try:
        offset = int(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor format") from exc
    if offset < 0:
        raise HTTPException(status_code=400, detail="Invalid cursor format")
    return offset


def _get_user_id(request: Request, db: Session) -> int:
    # TODO: Replace header-based stub with real auth (JWT) in T4.
    raw_id = request.headers.get("X-User-Id")
    if not raw_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        user_id = int(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid X-User-Id header") from exc

    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_id


def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def _decode_token(token: str) -> int:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        return int(subject)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    user_id = _decode_token(token)

    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _get_optional_user_id(request: Request, db: Session) -> int | None:
    raw_id = request.headers.get("X-User-Id")
    if not raw_id:
        token = _extract_bearer_token(request)
        if not token:
            return None
        user_id = _decode_token(token)
        user = db.query(User).filter(User.id == user_id).one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user_id
    try:
        user_id = int(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid X-User-Id header") from exc

    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_id


class UserInterestsIn(BaseModel):
    tags: list[str] = Field(default_factory=list)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class EventIn(BaseModel):
    paper_id: int
    action: EventType


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 200_000
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    dk_b64 = base64.b64encode(dk).decode("ascii")
    return f"pbkdf2_sha256${iterations}${salt_b64}${dk_b64}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations_raw, salt_b64, dk_b64 = stored_hash.split("$", 3)
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False

    try:
        iterations = int(iterations_raw)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(dk_b64)
    except (ValueError, TypeError):
        return False

    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return secrets.compare_digest(dk, expected)


def _create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@app.get("/feed")
def feed(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """
    Feed: guest или user (если передан X-User-Id).
    Сортировка по свежести (published_at DESC) с курсорной пагинацией.
    """
    query = db.query(Paper).filter(Paper.published_at.isnot(None))

    user_id = _get_optional_user_id(request, db)
    if user_id is not None:
        interest_tag_ids = [
            row[0]
            for row in db.query(UserInterest.tag_id)
            .filter(UserInterest.user_id == user_id)
            .all()
        ]
        if not interest_tag_ids:
            return {"items": [], "next_cursor": None}

        interest_ids_subq = (
            db.query(Paper.id)
            .join(Paper.tags)
            .filter(Tag.id.in_(interest_tag_ids))
            .distinct()
            .subquery()
        )
        base_query = db.query(Paper).join(
            interest_ids_subq, Paper.id == interest_ids_subq.c.id
        )

        hidden_exists = (
            db.query(Event.id)
            .filter(
                Event.user_id == user_id,
                Event.paper_id == Paper.id,
                Event.type == EventType.HIDE,
            )
            .exists()
        )
        base_query = base_query.filter(~hidden_exists)

        candidate_limit = max(
            CANDIDATE_POOL_MIN, min(CANDIDATE_POOL_DEFAULT, CANDIDATE_POOL_MAX)
        )
        candidate_ids = [
            row[0]
            for row in base_query.with_entities(Paper.id)
            .order_by(Paper.published_at.desc(), Paper.id.desc())
            .limit(candidate_limit)
            .all()
        ]
        logger.info(
            "candidate_pool_size=%s user_id=%s", len(candidate_ids), user_id
        )
        if not candidate_ids:
            return {"items": [], "next_cursor": None}

        query = query.filter(Paper.id.in_(candidate_ids))

        positive_ids = [
            row[0]
            for row in db.query(Event.paper_id)
            .filter(
                Event.user_id == user_id,
                Event.type.in_([EventType.LIKE, EventType.SAVE]),
            )
            .distinct()
            .all()
        ]

        ranked_ids: list[int] | None = None
        if positive_ids:
            try:
                response = httpx.post(
                    f"{settings.ml_service_url}/ml/rank",
                    json={
                        "user_id": user_id,
                        "positive_paper_ids": positive_ids,
                        "candidate_paper_ids": candidate_ids,
                    },
                    timeout=settings.ml_request_timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json()
                ranked = payload.get("ranked") or []
                ranked_ids = [
                    item["paper_id"]
                    for item in ranked
                    if "paper_id" in item
                ]
            except Exception as exc:
                logger.warning("ml_rank_failed user_id=%s error=%s", user_id, exc)
                ranked_ids = None

        if ranked_ids:
            offset = 0
            if cursor:
                offset = _parse_ml_cursor(cursor)

            ordered_ids = ranked_ids
            page_ids = ordered_ids[offset : offset + limit]
            if not page_ids:
                return {"items": [], "next_cursor": None}

            papers = (
                db.query(Paper)
                .filter(Paper.id.in_(page_ids))
                .all()
            )
            by_id = {paper.id: paper for paper in papers}
            items = [by_id[pid] for pid in page_ids if pid in by_id]

            next_cursor = None
            next_offset = offset + len(page_ids)
            if next_offset < len(ordered_ids):
                next_cursor = f"ml:{next_offset}"

            return {
                "items": [
                    {
                        "id": paper.id,
                        "title": paper.title,
                        "abstract": paper.abstract,
                        "authors": paper.authors,
                        "published_at": paper.published_at,
                        "doi": paper.doi,
                        "url": paper.url,
                    }
                    for paper in items
                ],
                "next_cursor": next_cursor,
            }

    if cursor:
        cursor_ts, cursor_id = _parse_cursor(cursor)
        query = query.filter(
            or_(
                Paper.published_at < cursor_ts,
                and_(Paper.published_at == cursor_ts, Paper.id < cursor_id),
            )
        )

    papers = (
        query.order_by(Paper.published_at.desc(), Paper.id.desc())
        .limit(limit + 1)
        .all()
    )

    items = papers[:limit]
    next_cursor = None
    if len(papers) > limit and items:
        last = items[-1]
        next_cursor = f"{last.published_at.isoformat()}|{last.id}"

    return {
        "items": [
            {
                "id": paper.id,
                "title": paper.title,
                "abstract": paper.abstract,
                "authors": paper.authors,
                "published_at": paper.published_at,
                "doi": paper.doi,
                "url": paper.url,
            }
            for paper in items
        ],
        "next_cursor": next_cursor,
    }


@app.get("/search")
def search(
    request: Request,
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    tag: str | None = None,
    source: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """
    Поиск по title + abstract (PostgreSQL full-text).
    """
    ts_vector = func.to_tsvector(
        "english",
        func.coalesce(Paper.title, "") + " " + func.coalesce(Paper.abstract, ""),
    )
    ts_query = func.plainto_tsquery("english", q)
    rank = func.ts_rank(ts_vector, ts_query)

    query = db.query(Paper).filter(ts_vector.op("@@")(ts_query))

    if tag:
        tag_value = tag.strip().lower()
        tag_ids_subq = (
            db.query(Paper.id)
            .join(Paper.tags)
            .filter(
                or_(
                    Tag.normalized_name == tag_value,
                    Tag.slug == tag_value,
                    Tag.name == tag,
                )
            )
            .distinct()
            .subquery()
        )
        query = query.join(tag_ids_subq, Paper.id == tag_ids_subq.c.id)

    if source:
        source_value = source.strip()
        query = (
            query.join(Source, Paper.source_id == Source.id)
            .filter(or_(Source.code == source_value, Source.name == source_value))
        )

    user_id = _get_optional_user_id(request, db)
    if user_id is not None:
        hidden_exists = (
            db.query(Event.id)
            .filter(
                Event.user_id == user_id,
                Event.paper_id == Paper.id,
                Event.type == EventType.HIDE,
            )
            .exists()
        )
        query = query.filter(~hidden_exists)

    papers = (
        query.order_by(rank.desc(), Paper.published_at.desc(), Paper.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": paper.id,
                "title": paper.title,
                "abstract": paper.abstract,
                "authors": paper.authors,
                "published_at": paper.published_at,
                "doi": paper.doi,
                "url": paper.url,
            }
            for paper in papers
        ]
    }


@app.post("/auth/register", status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> dict:
    existing = db.query(User).filter(User.email == payload.email).one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=_hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "created_at": user.created_at,
    }


@app.post("/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == payload.email).one_or_none()
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = _create_access_token(user)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": current_user.created_at,
    }


@app.post("/events", status_code=201)
def create_event(
    payload: EventIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    paper = db.query(Paper).filter(Paper.id == payload.paper_id).one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    event = Event(
        user_id=current_user.id,
        paper_id=payload.paper_id,
        type=payload.action,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return {
        "id": event.id,
        "paper_id": event.paper_id,
        "action": event.type,
        "created_at": event.created_at,
    }


@app.get("/me/likes")
def me_likes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    papers = (
        db.query(Paper)
        .join(Event, Event.paper_id == Paper.id)
        .filter(Event.user_id == current_user.id, Event.type == EventType.LIKE)
        .order_by(Event.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": paper.id,
                "title": paper.title,
                "abstract": paper.abstract,
                "authors": paper.authors,
                "published_at": paper.published_at,
                "doi": paper.doi,
                "url": paper.url,
            }
            for paper in papers
        ]
    }


@app.get("/me/saved")
def me_saved(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    papers = (
        db.query(Paper)
        .join(Event, Event.paper_id == Paper.id)
        .filter(Event.user_id == current_user.id, Event.type == EventType.SAVE)
        .order_by(Event.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": paper.id,
                "title": paper.title,
                "abstract": paper.abstract,
                "authors": paper.authors,
                "published_at": paper.published_at,
                "doi": paper.doi,
                "url": paper.url,
            }
            for paper in papers
        ]
    }


@app.put("/me/interests")
def update_interests(
    payload: UserInterestsIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """
    Replace user interests with provided tags (normalized_name).
    """
    user_id = _get_user_id(request, db)

    normalized = {t.strip().lower() for t in payload.tags if t and t.strip()}
    if not normalized:
        db.query(UserInterest).filter(UserInterest.user_id == user_id).delete()
        db.commit()
        return {"user_id": user_id, "tags": [], "count": 0}

    tags = db.query(Tag).filter(Tag.normalized_name.in_(normalized)).all()
    found = {t.normalized_name for t in tags}
    missing = sorted(normalized - found)
    if missing:
        raise HTTPException(status_code=400, detail={"missing_tags": missing})

    existing = (
        db.query(UserInterest)
        .filter(UserInterest.user_id == user_id)
        .all()
    )
    existing_ids = {ui.tag_id for ui in existing}
    target_ids = {tag.id for tag in tags}

    for ui in existing:
        if ui.tag_id not in target_ids:
            db.delete(ui)

    for tag in tags:
        if tag.id not in existing_ids:
            db.add(
                UserInterest(
                    user_id=user_id,
                    tag_id=tag.id,
                    weight=1,
                )
            )

    db.commit()
    return {"user_id": user_id, "tags": sorted(found), "count": len(found)}


@app.post("/admin/ingestion/run")
def admin_run_ingestion(db=Depends(get_db)) -> dict:
    """
    Запускает ingestion arXiv.
    Пока без аутентификации и сложной оркестрации — просто worker по требованию.
    """
    result = run_arxiv_ingestion(db)
    return result


@app.get("/admin/ingestion/status")
def admin_ingestion_status(db=Depends(get_db)) -> dict:
    """
    Возвращает статус последнего запуска ingestion:
    - источник
    - время последнего запуска
    - added / skipped / failed
    """
    last_run: IngestionRun | None = (
        db.query(IngestionRun)
        .order_by(IngestionRun.started_at.desc())
        .first()
    )
    if not last_run:
        return {
            "last_run_at": None,
            "source": None,
            "added": 0,
            "skipped": 0,
            "failed": 0,
        }

    source: Source | None = None
    if last_run.source_id is not None:
        source = db.query(Source).get(last_run.source_id)

    return {
        "last_run_at": last_run.finished_at or last_run.started_at,
        "source": source.code if source else None,
        "added": last_run.added,
        "skipped": last_run.skipped,
        "failed": last_run.failed,
    }
