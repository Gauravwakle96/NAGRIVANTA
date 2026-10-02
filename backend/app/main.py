"""Nagrivanta API — application entrypoint (§27).

Run:  uvicorn app.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, auth, issues, notifications, reports, risk, verification, work_orders
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="City Civic Intelligence Platform API — Report → Understand → Trust → Merge → Prioritize → Assign → Fix → Verify → Predict → Prevent.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api"

app.include_router(auth.router, prefix=f"{API}/auth")
app.include_router(reports.router, prefix=API)
app.include_router(issues.router, prefix=API)
app.include_router(work_orders.router, prefix=API)
app.include_router(verification.router, prefix=API)
app.include_router(risk.router, prefix=API)
app.include_router(analytics.router, prefix=API)
app.include_router(notifications.router, prefix=API)


@app.get(f"{API}/health")
def health():
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
        "notification_provider": settings.notification_provider,
        "ai_provider": settings.ai_provider,
    }


@app.post(f"{API}/reset")
def reset_demo():
    """Re-seed the database — demo convenience, disabled in a real deployment."""
    from app.core.database import Base, engine
    from app.core.seed import seed_if_empty

    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    return {"ok": True, "reseeded": True}
