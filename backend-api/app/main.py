from datetime import datetime, timedelta, timezone
import base64
import hashlib
import logging
import secrets

import httpx
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.db.session import get_db  # dependency для сессии БД
from app.services.ingestion_arxiv import run_arxiv_ingestion
from app.models import (
    Event,
    EventType,
    IngestionRun,
    Paper,
    ArticleComment,
    CommentReaction,
    Collection,
    CollectionItem,
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


def _normalize_nickname(value: str) -> str:
    raw = value.strip().lower().replace("@", "")
    cleaned = "".join(ch for ch in raw if ch.isalnum() or ch in ("_", "-"))
    return cleaned or "user"


def _ensure_unique_nickname(db: Session, base: str) -> str:
    candidate = _normalize_nickname(base)
    if not db.query(User).filter(User.nickname == candidate).first():
        return candidate
    suffix = secrets.token_hex(3)
    return f"{candidate}-{suffix}"


def _split_authors(raw: str | None) -> list[str]:
    if not raw:
        return []
    parts = [p.strip() for p in raw.split(";") if p.strip()]
    return parts or [raw.strip()]


def _author_objects(raw: str | None) -> list[dict]:
    authors = _split_authors(raw)
    payload = []
    for name in authors:
        author_id = hashlib.md5(name.encode("utf-8")).hexdigest()[:12]
        payload.append({"id": author_id, "name": name})
    return payload


def _paper_image_url(paper: Paper) -> str:
    return f"https://picsum.photos/seed/paper-{paper.id}/800/1000"


def _paper_source_label(paper: Paper) -> str:
    if paper.source and paper.source.name:
        return paper.source.name
    return "Unknown"


def _paper_link_url(paper: Paper) -> str | None:
    if paper.url:
        return paper.url
    if paper.doi:
        doi = paper.doi
        if doi.startswith("http://") or doi.startswith("https://"):
            return doi
        return f"https://doi.org/{doi}"
    return None


def _user_profile_dict(user: User, interests: list[str] | None = None) -> dict:
    base_name = user.email.split("@")[0] if user.email else "user"
    name = user.name or base_name.replace(".", " ").title()
    nickname = user.nickname or _normalize_nickname(base_name)
    avatar = user.avatar_url or f"https://i.pravatar.cc/150?u={user.id}"
    return {
        "id": str(user.id),
        "name": name,
        "nickname": nickname,
        "avatarUrl": avatar,
        "workplace": user.workplace,
        "fieldOfStudy": user.field_of_study,
        "bio": user.bio,
        "interests": interests or [],
    }


def _get_user_interests(db: Session, user_id: int) -> list[str]:
    rows = (
        db.query(Tag.name)
        .join(UserInterest, UserInterest.tag_id == Tag.id)
        .filter(UserInterest.user_id == user_id)
        .order_by(Tag.name.asc())
        .all()
    )
    return [row[0] for row in rows]


def _replace_user_interests(db: Session, user_id: int, tags: list[str]) -> list[str]:
    normalized = {t.strip().lower() for t in tags if t and t.strip()}
    db.query(UserInterest).filter(UserInterest.user_id == user_id).delete()
    if not normalized:
        db.commit()
        return []

    tag_rows = db.query(Tag).filter(Tag.normalized_name.in_(normalized)).all()
    known = {tag.normalized_name: tag for tag in tag_rows}
    for value in normalized:
        tag = known.get(value)
        if not tag:
            tag = Tag(name=value, slug=value, normalized_name=value)
            db.add(tag)
            db.flush()
        db.add(UserInterest(user_id=user_id, tag_id=tag.id))
    db.commit()
    return _get_user_interests(db, user_id)


def _like_counts(db: Session, paper_ids: list[int]) -> dict[int, int]:
    if not paper_ids:
        return {}
    rows = (
        db.query(Event.paper_id, func.count(Event.id))
        .filter(Event.type == EventType.LIKE, Event.paper_id.in_(paper_ids))
        .group_by(Event.paper_id)
        .all()
    )
    return {row[0]: row[1] for row in rows}


def _paper_to_article(paper: Paper, like_map: dict[int, int]) -> dict:
    published_at = paper.published_at or paper.created_at
    tags = [tag.name for tag in paper.tags] if paper.tags else []
    return {
        "id": str(paper.id),
        "title": paper.title,
        "abstract": paper.abstract or "",
        "authors": _author_objects(paper.authors),
        "tags": tags,
        "source": _paper_source_label(paper),
        "publishedAt": published_at.isoformat() if published_at else None,
        "doi": paper.doi or "",
        "url": _paper_link_url(paper),
        "imageUrl": _paper_image_url(paper),
        "likes": like_map.get(paper.id, 0),
    }


def _collection_to_dict(
    collection: Collection,
    like_map: dict[int, int] | None = None,
    include_items: bool = False,
) -> dict:
    article_ids = [str(item.paper_id) for item in collection.items]
    cover = collection.cover_image
    if not cover and collection.items:
        first_item = collection.items[0]
        if first_item.paper:
            cover = _paper_image_url(first_item.paper)
    payload = {
        "id": str(collection.id),
        "name": collection.name,
        "articleIds": article_ids,
        "coverImage": cover,
        "isPrivate": collection.visibility == "private",
        "visibility": collection.visibility,
        "ownerId": str(collection.user_id),
    }
    if include_items:
        like_map = like_map or {}
        payload["articles"] = [
            _paper_to_article(item.paper, like_map)
            for item in collection.items
            if item.paper is not None
        ]
    return payload


def _reaction_counts(reactions: list[CommentReaction]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for reaction in reactions:
        counts[reaction.emoji] = counts.get(reaction.emoji, 0) + 1
    return counts


def _comment_to_dict(comment: ArticleComment, viewer_id: int | None = None) -> dict:
    viewer_reaction = None
    if viewer_id is not None:
        viewer_reaction = next(
            (
                reaction.emoji
                for reaction in comment.reactions
                if reaction.user_id == viewer_id
            ),
            None,
        )

    return {
        "id": str(comment.id),
        "paperId": str(comment.paper_id),
        "content": comment.content,
        "author": _user_profile_dict(comment.author),
        "reactionCounts": _reaction_counts(comment.reactions),
        "viewerReaction": viewer_reaction,
        "canDelete": viewer_id == comment.author_id,
        "createdAt": comment.created_at.isoformat() if comment.created_at else None,
        "updatedAt": comment.updated_at.isoformat() if comment.updated_at else None,
    }


app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
    name: str | None = None
    nickname: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=8)
    new_password: str = Field(min_length=8)


class UserProfileUpdate(BaseModel):
    name: str | None = None
    nickname: str | None = None
    avatar_url: str | None = None
    workplace: str | None = None
    field_of_study: str | None = None
    bio: str | None = None
    interests: list[str] | None = None


class CollectionCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    visibility: str = "public"
    description: str | None = None
    cover_image: str | None = None


class CollectionUpdateIn(BaseModel):
    name: str | None = None
    visibility: str | None = None
    description: str | None = None
    cover_image: str | None = None


class CollectionItemIn(BaseModel):
    paper_id: int


class CommentCreateIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class CommentReactionIn(BaseModel):
    emoji: str = Field(default="heart", min_length=1, max_length=16)


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
    query = (
        db.query(Paper)
        .options(selectinload(Paper.tags), selectinload(Paper.source))
        .filter(Paper.published_at.isnot(None))
    )

    user_id = _get_optional_user_id(request, db)
    hidden_exists = None
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

        interest_tag_ids = [
            row[0]
            for row in db.query(UserInterest.tag_id)
            .filter(UserInterest.user_id == user_id)
            .all()
        ]
        if interest_tag_ids:
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
                query = query.filter(~hidden_exists)
            else:
                query = query.filter(Paper.id.in_(candidate_ids))

            if candidate_ids:
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
                        logger.warning(
                            "ml_rank_failed user_id=%s error=%s", user_id, exc
                        )
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
                        .options(selectinload(Paper.tags), selectinload(Paper.source))
                        .filter(Paper.id.in_(page_ids))
                        .all()
                    )
                    by_id = {paper.id: paper for paper in papers}
                    items = [by_id[pid] for pid in page_ids if pid in by_id]
                    like_map = _like_counts(db, [paper.id for paper in items])

                    next_cursor = None
                    next_offset = offset + len(page_ids)
                    if next_offset < len(ordered_ids):
                        next_cursor = f"ml:{next_offset}"

                    return {
                        "items": [
                            _paper_to_article(paper, like_map) for paper in items
                        ],
                        "next_cursor": next_cursor,
                    }
        else:
            query = query.filter(~hidden_exists)

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
    like_map = _like_counts(db, [paper.id for paper in items])
    next_cursor = None
    if len(papers) > limit and items:
        last = items[-1]
        next_cursor = f"{last.published_at.isoformat()}|{last.id}"

    return {
        "items": [_paper_to_article(paper, like_map) for paper in items],
        "next_cursor": next_cursor,
    }


@app.get("/search")
def search(
    request: Request,
    q: str | None = Query(None, min_length=2),
    limit: int = Query(20, ge=1, le=100),
    tags: list[str] | None = Query(None),
    source: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """
    Поиск по title + abstract (PostgreSQL full-text).
    """
    query = db.query(Paper).options(
        selectinload(Paper.tags), selectinload(Paper.source)
    )
    rank = None
    if q:
        ts_vector = func.to_tsvector(
            "english",
            func.coalesce(Paper.title, "") + " " + func.coalesce(Paper.abstract, ""),
        )
        ts_query = func.plainto_tsquery("english", q)
        rank = func.ts_rank(ts_vector, ts_query)
        query = query.filter(ts_vector.op("@@")(ts_query))

    if tags:
        normalized = []
        for tag in tags:
            if not tag:
                continue
            if "," in tag:
                normalized.extend([t.strip() for t in tag.split(",") if t.strip()])
            else:
                normalized.append(tag.strip())
        normalized = [t.lower() for t in normalized if t]
        if normalized:
            tag_ids_subq = (
                db.query(Paper.id)
                .join(Paper.tags)
                .filter(
                    or_(
                        Tag.normalized_name.in_(normalized),
                        Tag.slug.in_(normalized),
                        func.lower(Tag.name).in_(normalized),
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

    if rank is not None:
        query = query.order_by(rank.desc(), Paper.published_at.desc(), Paper.id.desc())
    else:
        query = query.order_by(Paper.published_at.desc(), Paper.id.desc())

    papers = query.limit(limit).all()
    like_map = _like_counts(db, [paper.id for paper in papers])

    return {"items": [_paper_to_article(paper, like_map) for paper in papers]}


@app.get("/papers/{paper_id}")
def get_paper(paper_id: int, db: Session = Depends(get_db)) -> dict:
    paper = (
        db.query(Paper)
        .options(selectinload(Paper.tags), selectinload(Paper.source))
        .filter(Paper.id == paper_id)
        .one_or_none()
    )
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    like_map = _like_counts(db, [paper.id])
    return _paper_to_article(paper, like_map)


@app.get("/papers/{paper_id}/comments")
def list_article_comments(
    paper_id: int,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    paper_exists = db.query(Paper.id).filter(Paper.id == paper_id).first()
    if not paper_exists:
        raise HTTPException(status_code=404, detail="Paper not found")

    viewer_id = _get_optional_user_id(request, db)
    base_query = (
        db.query(ArticleComment)
        .options(
            selectinload(ArticleComment.author),
            selectinload(ArticleComment.reactions),
        )
        .filter(ArticleComment.paper_id == paper_id)
        .order_by(ArticleComment.created_at.asc(), ArticleComment.id.asc())
    )
    comments = base_query.offset(offset).limit(limit + 1).all()
    page = comments[:limit]
    next_offset = offset + len(page) if len(comments) > limit else None
    return {
        "items": [_comment_to_dict(comment, viewer_id) for comment in page],
        "nextOffset": next_offset,
    }


@app.post("/papers/{paper_id}/comments", status_code=201)
def create_article_comment(
    paper_id: int,
    payload: CommentCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    paper = db.query(Paper).filter(Paper.id == paper_id).one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    comment = ArticleComment(
        paper_id=paper_id,
        author_id=current_user.id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    comment = (
        db.query(ArticleComment)
        .options(
            selectinload(ArticleComment.author),
            selectinload(ArticleComment.reactions),
        )
        .filter(ArticleComment.id == comment.id)
        .one()
    )
    return _comment_to_dict(comment, current_user.id)


@app.delete("/comments/{comment_id}")
def delete_article_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    comment = db.query(ArticleComment).filter(ArticleComment.id == comment_id).one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(comment)
    db.commit()
    return {"status": "ok"}


@app.post("/comments/{comment_id}/reactions", status_code=201)
def react_to_comment(
    comment_id: int,
    payload: CommentReactionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    emoji = payload.emoji.strip() or "heart"
    comment = db.query(ArticleComment).filter(ArticleComment.id == comment_id).one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = (
        db.query(CommentReaction)
        .filter(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == current_user.id,
            CommentReaction.emoji == emoji,
        )
        .one_or_none()
    )
    if not existing:
        db.add(
            CommentReaction(
                comment_id=comment_id,
                user_id=current_user.id,
                emoji=emoji,
            )
        )
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(status_code=409, detail="Reaction already exists") from exc

    comment = (
        db.query(ArticleComment)
        .options(
            selectinload(ArticleComment.author),
            selectinload(ArticleComment.reactions),
        )
        .filter(ArticleComment.id == comment_id)
        .one()
    )
    return _comment_to_dict(comment, current_user.id)


@app.delete("/comments/{comment_id}/reactions/{emoji}")
def remove_comment_reaction(
    comment_id: int,
    emoji: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    reaction = (
        db.query(CommentReaction)
        .filter(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == current_user.id,
            CommentReaction.emoji == emoji,
        )
        .one_or_none()
    )
    if reaction:
        db.delete(reaction)
        db.commit()

    comment = (
        db.query(ArticleComment)
        .options(
            selectinload(ArticleComment.author),
            selectinload(ArticleComment.reactions),
        )
        .filter(ArticleComment.id == comment_id)
        .one_or_none()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return _comment_to_dict(comment, current_user.id)


@app.get("/tags")
def list_tags(db: Session = Depends(get_db)) -> dict:
    tags = db.query(Tag).order_by(Tag.name.asc()).all()
    return {"items": [tag.name for tag in tags]}


@app.get("/auth/nickname-available")
def nickname_available(
    nickname: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
) -> dict:
    normalized = _normalize_nickname(nickname)
    exists = db.query(User.id).filter(User.nickname == normalized).first()
    return {"nickname": normalized, "available": not bool(exists)}


@app.post("/auth/register", status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> dict:
    existing = db.query(User).filter(User.email == payload.email).one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    base_name = payload.email.split("@")[0]
    name = payload.name or base_name.replace(".", " ").title()
    nickname_base = payload.nickname or base_name
    nickname = _ensure_unique_nickname(db, nickname_base)

    user = User(
        email=payload.email,
        password_hash=_hash_password(payload.password),
        name=name,
        nickname=nickname,
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
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    interests = _get_user_interests(db, current_user.id)
    return _user_profile_dict(current_user, interests=interests)


@app.put("/me")
def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.name is not None:
        current_user.name = payload.name
    if payload.nickname is not None:
        normalized = _normalize_nickname(payload.nickname)
        if normalized != current_user.nickname:
            current_user.nickname = _ensure_unique_nickname(db, normalized)
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    if payload.workplace is not None:
        current_user.workplace = payload.workplace
    if payload.field_of_study is not None:
        current_user.field_of_study = payload.field_of_study
    if payload.bio is not None:
        current_user.bio = payload.bio
    db.commit()
    db.refresh(current_user)

    interests = (
        _replace_user_interests(db, current_user.id, payload.interests)
        if payload.interests is not None
        else _get_user_interests(db, current_user.id)
    )
    return _user_profile_dict(current_user, interests=interests)


@app.post("/auth/change-password")
def change_password(
    payload: ChangePasswordIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not _verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid current password")
    current_user.password_hash = _hash_password(payload.new_password)
    db.commit()
    return {"status": "ok"}


@app.get("/users/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    interests = _get_user_interests(db, user.id)
    return _user_profile_dict(user, interests=interests)


@app.post("/events", status_code=201)
def create_event(
    payload: EventIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    paper = db.query(Paper).filter(Paper.id == payload.paper_id).one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    existing = (
        db.query(Event)
        .filter(
            Event.user_id == current_user.id,
            Event.paper_id == payload.paper_id,
            Event.type == payload.action,
        )
        .one_or_none()
    )
    if existing:
        return {
            "id": existing.id,
            "paper_id": existing.paper_id,
            "action": existing.type,
            "created_at": existing.created_at,
        }

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
        .options(selectinload(Paper.tags), selectinload(Paper.source))
        .join(Event, Event.paper_id == Paper.id)
        .filter(Event.user_id == current_user.id, Event.type == EventType.LIKE)
        .order_by(Event.created_at.desc())
        .all()
    )
    like_map = _like_counts(db, [paper.id for paper in papers])
    return {
        "items": [_paper_to_article(paper, like_map) for paper in papers]
    }


@app.get("/me/saved")
def me_saved(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    papers = (
        db.query(Paper)
        .options(selectinload(Paper.tags), selectinload(Paper.source))
        .join(Event, Event.paper_id == Paper.id)
        .filter(Event.user_id == current_user.id, Event.type == EventType.SAVE)
        .order_by(Event.created_at.desc())
        .all()
    )
    like_map = _like_counts(db, [paper.id for paper in papers])
    return {
        "items": [_paper_to_article(paper, like_map) for paper in papers]
    }


@app.get("/collections")
def list_collections(
    include_items: bool = Query(False),
    user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    target_user_id = user_id or current_user.id
    query = (
        db.query(Collection)
        .options(selectinload(Collection.items).selectinload(CollectionItem.paper))
        .filter(Collection.user_id == target_user_id)
    )
    if target_user_id != current_user.id:
        query = query.filter(Collection.visibility != "private")

    collections = query.order_by(Collection.created_at.desc()).all()
    like_map: dict[int, int] = {}
    if include_items:
        paper_ids = [
            item.paper_id
            for collection in collections
            for item in collection.items
        ]
        like_map = _like_counts(db, paper_ids)
    return {
        "items": [
            _collection_to_dict(
                col,
                like_map=like_map,
                include_items=include_items,
            )
            for col in collections
        ]
    }


@app.post("/collections", status_code=201)
def create_collection(
    payload: CollectionCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    visibility = payload.visibility or "public"
    if visibility not in {"public", "private", "followers"}:
        visibility = "public"
    collection = Collection(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        visibility=visibility,
        cover_image=payload.cover_image,
    )
    db.add(collection)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Collection already exists")
    db.refresh(collection)
    return _collection_to_dict(collection)


@app.put("/collections/{collection_id}")
def update_collection(
    collection_id: int,
    payload: CollectionUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    collection = (
        db.query(Collection)
        .options(selectinload(Collection.items).selectinload(CollectionItem.paper))
        .filter(Collection.id == collection_id)
        .one_or_none()
    )
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.name is not None:
        collection.name = payload.name
    if payload.description is not None:
        collection.description = payload.description
    if payload.visibility is not None:
        if payload.visibility not in {"public", "private", "followers"}:
            raise HTTPException(status_code=400, detail="Invalid visibility")
        collection.visibility = payload.visibility
    if payload.cover_image is not None:
        collection.cover_image = payload.cover_image

    db.commit()
    db.refresh(collection)
    return _collection_to_dict(collection)


@app.delete("/collections/{collection_id}")
def delete_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    collection = db.query(Collection).filter(Collection.id == collection_id).one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(collection)
    db.commit()
    return {"status": "ok"}


@app.post("/collections/{collection_id}/items", status_code=201)
def add_collection_item(
    collection_id: int,
    payload: CollectionItemIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    collection = db.query(Collection).filter(Collection.id == collection_id).one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    paper = db.query(Paper).filter(Paper.id == payload.paper_id).one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    existing = (
        db.query(CollectionItem)
        .filter(
            CollectionItem.collection_id == collection_id,
            CollectionItem.paper_id == payload.paper_id,
        )
        .one_or_none()
    )
    if not existing:
        db.add(
            CollectionItem(collection_id=collection_id, paper_id=payload.paper_id)
        )
        if not collection.cover_image:
            collection.cover_image = _paper_image_url(paper)

        save_event = (
            db.query(Event)
            .filter(
                Event.user_id == current_user.id,
                Event.paper_id == payload.paper_id,
                Event.type == EventType.SAVE,
            )
            .one_or_none()
        )
        if not save_event:
            db.add(
                Event(
                    user_id=current_user.id,
                    paper_id=payload.paper_id,
                    type=EventType.SAVE,
                )
            )
    db.commit()
    return {"status": "ok"}


@app.delete("/collections/{collection_id}/items/{paper_id}")
def remove_collection_item(
    collection_id: int,
    paper_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    collection = db.query(Collection).filter(Collection.id == collection_id).one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    item = (
        db.query(CollectionItem)
        .filter(
            CollectionItem.collection_id == collection_id,
            CollectionItem.paper_id == paper_id,
        )
        .one_or_none()
    )
    if item:
        db.delete(item)
        db.commit()
    return {"status": "ok"}


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

    interests = _replace_user_interests(db, user_id, payload.tags)
    return {"user_id": user_id, "tags": interests, "count": len(interests)}


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
