import os
from functools import lru_cache


class Settings:
    """
    Минимальные настройки для backend-api.
    """

    # Метаданные приложения
    app_title: str = "SciVisE Backend API"
    app_version: str = "0.1.0"
    jwt_algorithm: str = "HS256"

    @property
    def database_url(self) -> str:
        value = os.getenv("DATABASE_URL")
        if not value:
            raise RuntimeError("DATABASE_URL is not set in environment")
        return value

    @property
    def jwt_secret(self) -> str:
        value = os.getenv("JWT_SECRET")
        if value:
            return value
        # TODO: set JWT_SECRET in environment for production deployments.
        return "dev-secret"

    @property
    def access_token_ttl_minutes(self) -> int:
        raw = os.getenv("JWT_ACCESS_TTL_MINUTES", "60")
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError("JWT_ACCESS_TTL_MINUTES must be an integer") from exc
        if value <= 0:
            raise RuntimeError("JWT_ACCESS_TTL_MINUTES must be positive")
        return value

    @property
    def ml_service_url(self) -> str:
        return os.getenv("ML_SERVICE_URL", "http://ml-service:8001")

    @property
    def ml_request_timeout_seconds(self) -> float:
        raw = os.getenv("ML_REQUEST_TIMEOUT_SECONDS", "5")
        try:
            value = float(raw)
        except ValueError as exc:
            raise RuntimeError("ML_REQUEST_TIMEOUT_SECONDS must be a number") from exc
        if value <= 0:
            raise RuntimeError("ML_REQUEST_TIMEOUT_SECONDS must be positive")
        return value

    @property
    def cors_origins(self) -> list[str]:
        raw = os.getenv("BACKEND_CORS_ORIGINS", "")
        if not raw:
            return []
        return [item.strip() for item in raw.split(",") if item.strip()]

    @property
    def arxiv_ingestion_enabled(self) -> bool:
        raw = os.getenv("ARXIV_INGESTION_ENABLED", "1").strip().lower()
        return raw in {"1", "true", "yes", "on"}

    @property
    def arxiv_ingestion_interval_seconds(self) -> int:
        raw = os.getenv("ARXIV_INGESTION_INTERVAL_SECONDS", "300")
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError("ARXIV_INGESTION_INTERVAL_SECONDS must be an integer") from exc
        if value < 60:
            raise RuntimeError("ARXIV_INGESTION_INTERVAL_SECONDS must be at least 60")
        return value

    @property
    def arxiv_ingestion_batch_size(self) -> int:
        raw = os.getenv("ARXIV_INGESTION_BATCH_SIZE", "100")
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError("ARXIV_INGESTION_BATCH_SIZE must be an integer") from exc
        if value <= 0 or value > 200:
            raise RuntimeError("ARXIV_INGESTION_BATCH_SIZE must be between 1 and 200")
        return value

    @property
    def arxiv_ingestion_target_total(self) -> int:
        raw = os.getenv("ARXIV_INGESTION_TARGET_TOTAL", "5000")
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError("ARXIV_INGESTION_TARGET_TOTAL must be an integer") from exc
        if value < 100:
            raise RuntimeError("ARXIV_INGESTION_TARGET_TOTAL must be at least 100")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
