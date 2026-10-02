"""Prediction service — synthetic history based risk engine (§17).

Everything produced is SIMULATED; no accuracy claim is made.
"""

import math

from app.models.entities import IssueCategory
from app.schemas import RiskFactorOut, RiskPredictionOut, RiskTrendPoint

CATEGORIES = [
    IssueCategory.POTHOLE,
    IssueCategory.WATER_LEAK,
    IssueCategory.GARBAGE,
    IssueCategory.STREETLIGHT,
    IssueCategory.DRAINAGE,
    IssueCategory.ROAD_DAMAGE,
]

LABELS = {
    IssueCategory.POTHOLE: "Potholes",
    IssueCategory.WATER_LEAK: "Water leaks",
    IssueCategory.GARBAGE: "Garbage",
    IssueCategory.STREETLIGHT: "Streetlights",
    IssueCategory.DRAINAGE: "Drainage",
    IssueCategory.ROAD_DAMAGE: "Road damage",
}

ACTIONS = {
    IssueCategory.POTHOLE: "Pre-emptive patching on the highlighted corridor before peak traffic week; inspect resurfacing age.",
    IssueCategory.WATER_LEAK: "Acoustic leak survey along the corridor; prioritise joints near the highlighted zone.",
    IssueCategory.GARBAGE: "Increase collection frequency in this ward and audit bin placement for the next cycle.",
    IssueCategory.STREETLIGHT: "Schedule preventive lamp/driver replacement round in this zone before the dark season.",
    IssueCategory.DRAINAGE: "Pre-monsoon de-silting of the highlighted drains; clear outfalls now.",
    IssueCategory.ROAD_DAMAGE: "Surface condition survey on the corridor; plan patch repair while weather holds.",
}

MONTHS = 12


def _mulberry(seed: int):
    a = seed & 0xFFFFFFFF

    def rnd() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= t + ((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rnd


def city_history() -> dict[IssueCategory, list[int]]:
    """12 months of deterministic synthetic incident counts per category."""
    out: dict[IssueCategory, list[int]] = {}
    for ci, cat in enumerate(CATEGORIES):
        rnd = _mulberry(7700 + ci * 97)
        base = 14 + int(rnd() * 22)
        phase = ci * 0.9
        series: list[int] = []
        for m in range(MONTHS):
            seasonal = math.sin((m / 12) * 2 * math.pi + phase) * (base * 0.35)
            drift = m * 0.55
            noise = (rnd() - 0.5) * base * 0.3
            series.append(max(2, round(base + seasonal + drift + noise)))
        out[cat] = series
    return out


def _slope(xs: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mean_x = (n - 1) / 2
    mean_y = sum(xs) / n
    num = sum((i - mean_x) * (v - mean_y) for i, v in enumerate(xs))
    den = sum((i - mean_x) ** 2 for i in range(n))
    return 0.0 if den == 0 else num / den


def _avg(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


class PredictionEngine:
    def predict(self, horizon: int, zones: list[dict]) -> list[RiskPredictionOut]:
        raise NotImplementedError


class DemoPredictionEngine(PredictionEngine):
    def predict(self, horizon: int, zones: list[dict]) -> list[RiskPredictionOut]:
        history = city_history()
        horizon_factor = {7: 1, 30: 4, 90: 12}.get(horizon, 4)
        preds: list[RiskPredictionOut] = []
        seq = 1

        month_labels = []
        now_month = 9  # fixed labels keep output deterministic across refreshes
        for i in range(6):
            month_labels.append(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(now_month - 5 + i) % 12])

        for ci, cat in enumerate(CATEGORIES):
            series = history[cat]
            recent = series[-3:]
            longer = series[-6:]
            sl = _slope([float(x) for x in longer])
            base = _avg([float(x) for x in recent])

            ranked = sorted(zones, key=lambda z: -(0.75 + _mulberry((z["index"] * 31 + ord(cat.value[0]) * 7))() * 0.6))
            for zone in ranked[:2]:
                bias = 0.75 + _mulberry((zone["index"] * 31 + ord(cat.value[0]) * 7))() * 0.6
                biased = base * bias
                current = min(100, round((biased / 45) * 100))
                projected = biased + sl * (horizon_factor / 2) * bias
                predicted = max(0, min(100, round((projected / 45) * 100)))

                trend = [RiskTrendPoint(t=month_labels[i], value=round(v * bias)) for i, v in enumerate(longer)]
                traffic = zone.get("traffic_class", "LOCAL")
                factors = [
                    RiskFactorOut(
                        label="Recent incident volume",
                        detail=f"{round(biased)} reports/month in the last 3 months for {LABELS[cat].lower()}.",
                        contribution=min(40, round(current * 0.4)),
                    ),
                    RiskFactorOut(
                        label="Six-month trend",
                        detail=f"{'Rising' if sl >= 0 else 'Easing'} {abs(sl):.1f} incidents/month.",
                        contribution=min(30, round(abs(sl) * 6) + 8),
                    ),
                    RiskFactorOut(
                        label="Corridor exposure",
                        detail=f"{traffic.lower()} road in {zone['name']} raises impact if unfixed.",
                        contribution=20 if traffic == "ARTERIAL" else 14 if traffic == "COLLECTOR" else 9,
                    ),
                    RiskFactorOut(
                        label="Category SLA pressure",
                        detail=f"Standard response window for {LABELS[cat]} is tracked per category.",
                        contribution=10 if cat in (IssueCategory.WATER_LEAK, IssueCategory.DRAINAGE) else 6,
                    ),
                ]

                label = "HIGH" if max(current, predicted) >= 66 else "MEDIUM" if max(current, predicted) >= 38 else "LOW"
                preds.append(
                    RiskPredictionOut(
                        id=f"RSK-{seq:03d}",
                        category=cat,
                        zone_name=zone["name"],
                        point={"lat": zone["lat"], "lng": zone["lng"]},
                        radius_meters=420 if cat in (IssueCategory.POTHOLE, IssueCategory.ROAD_DAMAGE) else 320,
                        current_risk=current,
                        predicted_risk=predicted,
                        horizon_days=horizon,
                        trend=trend,
                        factors=factors,
                        recommended_action=ACTIONS[cat],
                        label=label,
                    )
                )
                seq += 1

        preds.sort(key=lambda p: p.predicted_risk, reverse=True)
        return preds


prediction_engine = DemoPredictionEngine()
