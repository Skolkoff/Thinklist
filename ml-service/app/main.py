import logging

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.db.session import check_db, fetch_papers
from app.services.recommender import rebuild_index, rank_candidates


settings = get_settings()
logger = logging.getLogger("uvicorn.error")

app = FastAPI(title=settings.app_title)


def _rebuild_from_database(limit: int | None = None) -> dict:
    rows = fetch_papers(limit=limit)
    stats = rebuild_index(rows)
    logger.info(
        "ml_index_rebuilt documents=%s vocab_size=%s limit=%s",
        stats.get("documents"),
        stats.get("vocab_size"),
        limit,
    )
    return stats


@app.on_event("startup")
def bootstrap_index() -> None:
    try:
        _rebuild_from_database()
    except Exception:
        logger.exception("ml_index_startup_rebuild_failed")


@app.get("/health")
async def health() -> dict:
    """
    Simple healthcheck endpoint for docker-compose.
    No ML logic here yet, just returns a static status.
    """
    if not check_db():
        raise HTTPException(status_code=503, detail="db_unavailable")
    return {"status": "ok", "db": "ok"}


@app.post("/ml/rebuild")
def rebuild(limit: int | None = Query(None, ge=1)) -> dict:
    stats = _rebuild_from_database(limit=limit)
    return {"status": "ok", "limit": limit, **stats}


class RankIn(BaseModel):
    user_id: int | None = None
    positive_paper_ids: list[int] = Field(default_factory=list)
    candidate_paper_ids: list[int] = Field(default_factory=list)


@app.post("/ml/rank")
def rank(payload: RankIn) -> dict:
    try:
        ranked = rank_candidates(payload.positive_paper_ids, payload.candidate_paper_ids)
    except RuntimeError:
        _rebuild_from_database()
        try:
            ranked = rank_candidates(
                payload.positive_paper_ids, payload.candidate_paper_ids
            )
        except RuntimeError:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "model_not_ready",
                    "rebuild": "POST /ml/rebuild",
                },
            )
    return {
        "ranked": [
            {"paper_id": paper_id, "score": score} for paper_id, score in ranked
        ]
    }
