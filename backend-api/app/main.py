from fastapi import Depends, FastAPI

from app.core.config import get_settings
from app.db.session import get_db  # dependency для сессии БД
from app.services.ingestion_arxiv import run_arxiv_ingestion
from app.models import IngestionRun, Source


settings = get_settings()

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

