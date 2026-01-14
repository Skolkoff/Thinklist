import os
from functools import lru_cache


class Settings:
    """
    Минимальные настройки для backend-api.
    """

    # Метаданные приложения
    app_title: str = "SciVisE Backend API"
    app_version: str = "0.1.0"

    @property
    def database_url(self) -> str:
        value = os.getenv("DATABASE_URL")
        if not value:
            raise RuntimeError("DATABASE_URL is not set in environment")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


