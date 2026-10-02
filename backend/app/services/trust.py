"""Trust service — explainable report credibility score (§5 Intelligence)."""

from datetime import datetime

from app.schemas import TrustFactor, TrustScoreOut

HAS_IMAGE = 34
HAS_LOCATION = 24
DESC_GOOD = 18
DESC_SHORT = -12
KNOWN_REPORTER = 10
NEARBY_CORROBORATION = 12


class TrustEngine:
    def evaluate(
        self,
        *,
        report_id: str,
        description: str,
        has_image: bool,
        has_location: bool,
        known_reporter: bool,
        nearby_existing_count: int,
    ) -> TrustScoreOut:
        raise NotImplementedError


class DemoTrustEngine(TrustEngine):
    def evaluate(
        self,
        *,
        report_id: str,
        description: str,
        has_image: bool,
        has_location: bool,
        known_reporter: bool,
        nearby_existing_count: int,
    ) -> TrustScoreOut:
        factors: list[TrustFactor] = []
        score = 0

        if has_image:
            score += HAS_IMAGE
            factors.append(TrustFactor(label="Photo evidence attached", detail=f"Image present (+{HAS_IMAGE}).", impact="POSITIVE"))
        else:
            score += DESC_SHORT
            factors.append(TrustFactor(label="No photo evidence", detail=f"Missing image reduces confidence ({DESC_SHORT}).", impact="NEGATIVE"))

        if has_location:
            score += HAS_LOCATION
            factors.append(TrustFactor(label="Location provided", detail=f"Pin present (+{HAS_LOCATION}).", impact="POSITIVE"))
        else:
            score -= 15
            factors.append(TrustFactor(label="No location", detail="Report has no coordinate pin.", impact="NEGATIVE"))

        desc = description.strip()
        if len(desc) >= 40:
            score += DESC_GOOD
            factors.append(TrustFactor(label="Descriptive report", detail=f"{len(desc)} characters of detail (+{DESC_GOOD}).", impact="POSITIVE"))
        elif len(desc) < 15:
            score += DESC_SHORT
            factors.append(TrustFactor(label="Very short description", detail=f"Only {len(desc)} characters ({DESC_SHORT}).", impact="NEGATIVE"))
        else:
            factors.append(TrustFactor(label="Brief description", detail="Adequate but not detailed.", impact="NEUTRAL"))

        if known_reporter:
            score += KNOWN_REPORTER
            factors.append(TrustFactor(label="Known reporter", detail=f"Reporter has prior accepted submissions (+{KNOWN_REPORTER}).", impact="POSITIVE"))

        if nearby_existing_count > 0:
            score += NEARBY_CORROBORATION
            factors.append(
                TrustFactor(
                    label="Corroborated by nearby reports",
                    detail=f"{nearby_existing_count} independent report(s) within 350 m (+{NEARBY_CORROBORATION}).",
                    impact="POSITIVE",
                )
            )
        else:
            factors.append(TrustFactor(label="No corroboration yet", detail="No other reports nearby — single source.", impact="NEUTRAL"))

        score = max(0, min(100, score))

        if score >= 78 and (has_image or nearby_existing_count >= 2):
            label = "LIKELY_GENUINE"
        elif nearby_existing_count >= 2:
            label = "SIMILAR_REPORT"
        elif score >= 55:
            label = "LIKELY_GENUINE"
        else:
            label = "NEEDS_REVIEW"

        return TrustScoreOut(
            report_id=report_id,
            score=score,
            label=label,
            factors=factors,
            engine="DemoTrustEngine v1",
            evaluated_at=datetime.utcnow(),
        )


trust_engine = DemoTrustEngine()
