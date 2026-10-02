"""Core configuration (§40): env-driven, secrets never in code (§32)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings.

    DATABASE_URL defaults to a local SQLite file so the backend runs with
    zero external services (§24). Point it at PostgreSQL/Supabase for a real
    deployment — schema uses plain lat/lng floats plus comments marking the
    PostGIS migration path (§31).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Nagrivanta API"
    demo_mode: bool = True
    database_url: str = "sqlite:///./nagrivanta.db"

    # Demo auth: header-based role assertion used until a real identity
    # provider (e.g. Supabase Auth) is wired behind the same interface.
    default_role: str = "CITY_ADMIN"
    default_user_id: str = "u-admin-1"

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Future provider selection — boundaries exist, integrations are NOT faked.
    notification_provider: str = "demo"  # demo | email | sms | whatsapp (future)
    ai_provider: str = "demo"  # demo | external (future)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
