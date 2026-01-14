from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings


settings = get_settings()

engine = create_engine(settings.database_url, future=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)


def get_db():
    """
    Зависимость FastAPI для получения сессии БД.
    На этом этапе не используется в ручках, но готово для следующих задач.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


