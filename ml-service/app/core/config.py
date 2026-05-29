import os
from functools import lru_cache
from pathlib import Path


class Settings:
    """
    Минимальные настройки для ml-service.
    """

    app_title: str = "SciVisE ML Service"

    @property
    def database_url(self) -> str:
        value = os.getenv("DATABASE_URL")
        if not value:
            raise RuntimeError("DATABASE_URL is not set in environment")
        return value

    @property
    def artifacts_dir(self) -> Path:
        value = os.getenv("ML_ARTIFACTS_DIR")
        if value:
            return Path(value)
        return Path(__file__).resolve().parents[2] / "artifacts"


@lru_cache
def get_settings() -> Settings:
    return Settings()
