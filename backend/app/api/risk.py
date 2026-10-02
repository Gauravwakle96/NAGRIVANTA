"""Risk API — synthetic predictions (§17)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_any
from app.models.entities import RiskZone
from app.services.prediction import prediction_engine

router = APIRouter(tags=["risk"])


@router.get("/risk")
def risk_predictions(horizon: int = Query(default=30, ge=7, le=90), db: Session = Depends(get_db), _=Depends(require_any)):
    zones = []
    for i, z in enumerate(db.query(RiskZone).all()):
        zones.append({
            "index": i, "id": z.id, "name": z.name,
            "lat": z.lat, "lng": z.lng, "traffic_class": _traffic(z.id),
        })
    preds = prediction_engine.predict(horizon, zones)
    return [p.model_dump(mode="json", by_alias=True) for p in preds]


def _traffic(zone_id: str) -> str:
    classes = {"z-mg": "ARTERIAL", "z-stn": "ARTERIAL", "z-air": "ARTERIAL",
               "z-civ": "COLLECTOR", "z-mkt": "COLLECTOR", "z-old": "COLLECTOR", "z-grn": "COLLECTOR"}
    return classes.get(zone_id, "LOCAL")
