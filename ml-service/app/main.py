from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.db.session import check_db, fetch_papers
from app.services.recommender import rebuild_index, rank_candidates


settings = get_settings()

app = FastAPI(title=settings.app_title)


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
    rows = fetch_papers(limit=limit)
    stats = rebuild_index(rows)
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
        raise HTTPException(status_code=503, detail="model_not_ready")
    return {
        "ranked": [
            {"paper_id": paper_id, "score": score} for paper_id, score in ranked
        ]
    }
