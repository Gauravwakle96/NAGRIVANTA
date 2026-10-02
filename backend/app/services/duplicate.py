"""Duplicate service — haversine + text similarity clustering (§13)."""

import math

from app.models.entities import IssueCategory
from app.schemas import DuplicateAnalysisOut, DuplicateMatch

RADIUS_M = 350
MIN_SIMILARITY = 0.42
WINDOW_DAYS = 14


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def text_similarity(a: str, b: str) -> float:
    def toks(s: str) -> set[str]:
        return {w for w in "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in s.lower()).split() if len(w) > 2}

    ta, tb = toks(a), toks(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


class DuplicateEngine:
    def analyze(self, candidate: dict, others: list[dict]) -> DuplicateAnalysisOut:
        raise NotImplementedError


class DemoDuplicateEngine(DuplicateEngine):
    def analyze(self, candidate: dict, others: list[dict]) -> DuplicateAnalysisOut:
        matches: list[DuplicateMatch] = []
        cand_cat = candidate.get("category")

        for other in others:
            if other["id"] == candidate["id"]:
                continue
            dist = haversine_m(candidate["lat"], candidate["lng"], other["lat"], other["lng"])
            if dist > RADIUS_M:
                continue
            sim = text_similarity(candidate["description"], other["description"])
            cat_agree = cand_cat is not None and other.get("category") == cand_cat
            if not (sim >= MIN_SIMILARITY or cat_agree):
                continue
            matches.append(
                DuplicateMatch(
                    report_id=other["id"],
                    issue_id=other.get("issue_id") or "",
                    distance_meters=round(dist),
                    category_agree=cat_agree,
                    description_similarity=round(sim, 2),
                )
            )

        matches.sort(key=lambda m: m.distance_meters)

        counts: dict[str, int] = {}
        for m in matches:
            if m.issue_id:
                counts[m.issue_id] = counts.get(m.issue_id, 0) + 1
        suggested = max(counts, key=counts.get) if counts else None  # type: ignore[arg-type]

        return DuplicateAnalysisOut(
            candidate_report_id=candidate["id"],
            matches=matches,
            matched_count=len(matches),
            nearest_distance_meters=matches[0].distance_meters if matches else None,
            suggested_master_issue_id=suggested,
            threshold=MIN_SIMILARITY,
        )


duplicate_engine = DemoDuplicateEngine()
