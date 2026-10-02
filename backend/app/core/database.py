"""SQLAlchemy engine/session setup.

SQLite by default (file-based, zero-config). For PostgreSQL/Supabase set
DATABASE_URL=postgresql+psycopg://... — no query changes required.

PostGIS readiness: location columns are `lat`/`lng` floats. Migration path
documented in app/models/entities.py — swap to `geography(Point, 4326)`
columns with a partial index; services keep reading `.lat`/`.lng` properties.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args, future=True)

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):  # pragma: no cover
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables. Alembic migrations would replace this in production."""
    from app import models  # noqa: F401  (register mappings)

    Base.metadata.create_all(bind=engine)
