"""Priority service — weighted, fully explainable scoring (§12)."""

from datetime import datetime

from app.models.entities import IssueCategory, Priority
from app.schemas import PriorityFactor, PriorityScoreOut

REPORT_PER = 6
REPORT_MAX = 30
TRAFFIC_POINTS = {"ARTERIAL": 16, "COLLECTOR": 10, "LOCAL": 4}
SAFETY_POINTS = {
    IssueCategory.WATER_LEAK: 14,
    IssueCategory.DRAINAGE: 12,
    IssueCategory.POTHOLE: 12,
    IssueCategory.ROAD_DAMAGE: 8,
    IssueCategory.STREETLIGHT: 6,
    IssueCategory.GARBAGE: 4,
}
SEVERITY_POINTS = {"LOW": 10, "MEDIUM": 22, "HIGH": 34}
REPEAT_POINTS = 10
AGE_PER_DAY = 2
AGE_MAX = 12
THRESHOLDS = {"MEDIUM": 30, "HIGH": 55, "CRITICAL": 78}


class PriorityEngine:
    def calculate(
        self,
        *,
        report_count: int,
        severity: str,
        category: IssueCategory,
        traffic_class: str,
        days_open: float,
        prior_work_orders: int,
    ) -> PriorityScoreOut:
        raise NotImplementedError


class DemoPriorityEngine(PriorityEngine):
    def calculate(
        self,
        *,
        report_count: int,
        severity: str,
        category: IssueCategory,
        traffic_class: str,
        days_open: float,
        prior_work_orders: int,
    ) -> PriorityScoreOut:
        factors: list[PriorityFactor] = []
        score = 0

        vol = min(REPORT_MAX, report_count * REPORT_PER)
        if vol > 0:
            factors.append(
                PriorityFactor(
                    label=f"{report_count} report{'s' if report_count > 1 else ''} in cluster",
                    detail=f"{REPORT_PER} pts each, cap {REPORT_MAX}.",
                    weight=REPORT_PER,
                    points=vol,
                )
            )
            score += vol

        traffic = TRAFFIC_POINTS.get(traffic_class, 4)
        factors.append(PriorityFactor(label=f"{traffic_class.lower()} road corridor", detail="Traffic exposure weighting.", weight=traffic, points=traffic))
        score += traffic

        safety = SAFETY_POINTS.get(category, 6)
        factors.append(PriorityFactor(label="Safety impact", detail=f"Category safety weighting for {category.value}.", weight=safety, points=safety))
        score += safety

        sev = SEVERITY_POINTS.get(severity, 10)
        factors.append(PriorityFactor(label=f"{severity.lower()} severity", detail="Classifier severity contribution.", weight=sev, points=sev))
        score += sev

        if prior_work_orders > 0:
            factors.append(
                PriorityFactor(
                    label="Repeat location",
                    detail=f"{prior_work_orders} previous work order(s) at this location.",
                    weight=REPEAT_POINTS,
                    points=REPEAT_POINTS,
                )
            )
            score += REPEAT_POINTS

        age = min(AGE_MAX, int(days_open) * AGE_PER_DAY)
        if age > 0:
            factors.append(
                PriorityFactor(
                    label="Ageing issue",
                    detail=f"{int(days_open)} day(s) open at +{AGE_PER_DAY}/day (cap {AGE_MAX}).",
                    weight=AGE_PER_DAY,
                    points=age,
                )
            )
            score += age

        score = max(0, min(100, score))
        if score >= THRESHOLDS["CRITICAL"]:
            level = Priority.CRITICAL
        elif score >= THRESHOLDS["HIGH"]:
            level = Priority.HIGH
        elif score >= THRESHOLDS["MEDIUM"]:
            level = Priority.MEDIUM
        else:
            level = Priority.LOW

        top = sorted(factors, key=lambda f: f.points, reverse=True)[:3]
        explanation = (
            "No contributing factors recorded."
            if score == 0
            else f"Scored {score}/100 → {level.value}. Driven by " + ", ".join(f"{f.label} (+{f.points})" for f in top) + "."
        )

        return PriorityScoreOut(
            score=score,
            level=level,
            factors=factors,
            explanation=explanation,
            calculated_at=datetime.utcnow(),
        )


priorityEngine = DemoPriorityEngine()
