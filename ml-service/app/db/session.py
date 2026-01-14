from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings


settings = get_settings()

engine = create_engine(settings.database_url, future=True, pool_pre_ping=True)


def check_db() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False


def fetch_papers(limit: int | None = None) -> list[tuple[int, str, str | None]]:
    query = (
        "SELECT id, title, abstract FROM papers "
        "WHERE title IS NOT NULL "
        "ORDER BY id"
    )
    params: dict[str, int] = {}
    if limit:
        query += " LIMIT :limit"
        params["limit"] = limit
    with engine.connect() as conn:
        rows = conn.execute(text(query), params).fetchall()
    return [(row[0], row[1], row[2]) for row in rows]
