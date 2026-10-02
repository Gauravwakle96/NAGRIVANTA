"""Verification service — before/after evidence checks (§20)."""

from dataclasses import dataclass

from app.services.duplicate import haversine_m

MAX_DRIFT_M = 150


@dataclass
class VerificationCheck:
    key: str
    label: str
    passed: bool
    detail: str

    def as_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "pass": self.passed, "detail": self.detail}


class VerificationEngine:
    def verify(self, **kwargs) -> tuple[str, list[dict]]:
        raise NotImplementedError


class DemoVerificationEngine(VerificationEngine):
    def verify(
        self,
        *,
        has_before: bool,
        has_after: bool,
        before_point: tuple[float, float] | None,
        after_point: tuple[float, float] | None,
        repaired_flag: bool,
        hours_since_repair: float,
        citizen_reopened: bool,
    ) -> tuple[str, list[dict]]:
        checks: list[VerificationCheck] = []

        loc_ok = bool(
            before_point
            and after_point
            and haversine_m(before_point[0], before_point[1], after_point[0], after_point[1]) <= MAX_DRIFT_M
        )
        checks.append(
            VerificationCheck(
                "location",
                "Location match",
                loc_ok,
                "Before and after photos are at the same coordinate." if loc_ok else "Before/after coordinates missing or too far apart.",
            )
        )

        checks.append(
            VerificationCheck(
                "timestamp",
                "Evidence timestamps",
                has_before and has_after,
                "Both evidence photos have upload timestamps." if has_before and has_after else "Missing before or after evidence upload.",
            )
        )

        uploaded = " + ".join(x for x in ("before" if has_before else None, "after" if has_after else None) if x) or "none"
        checks.append(VerificationCheck("evidence", "Evidence completeness", has_before and has_after, f"{uploaded} uploaded."))

        visual = repaired_flag and has_after
        checks.append(
            VerificationCheck(
                "visual",
                "Reported repair complete",
                visual,
                "Crew marked the repair complete with after evidence." if visual else "Crew has not confirmed repair completion.",
            )
        )

        fresh = hours_since_repair <= 72
        if citizen_reopened:
            persist_detail = "Citizen reported the issue persisting after repair."
        elif fresh:
            persist_detail = "No reopen reported within the observation window."
        else:
            persist_detail = "Observation window expired without citizen confirmation."
        checks.append(VerificationCheck("persistence", "Issue persistence check", fresh and not citizen_reopened, persist_detail))

        result = "RESOLVED" if all(c.passed for c in checks) else "REINSPECTION_REQUIRED"
        return result, [c.as_dict() for c in checks]


verification_engine = DemoVerificationEngine()
