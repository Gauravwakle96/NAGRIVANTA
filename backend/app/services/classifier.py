"""Classification service — trained text model with keyword-heuristic fallback.

Provider boundary (§26): `Classifier.classify` is the contract. When the
training artifact (`artifacts/classifier.joblib`) is present, predictions come
from the TF-IDF + logistic-regression model trained locally on synthetic data
(see `training.py`); otherwise the deterministic keyword heuristic below runs.
Either way the API keeps `simulated: true` — the model learned from generated
corpus, not real civic history.
"""

from pathlib import Path

from app.models.entities import IssueCategory
from app.schemas import ClassificationOut

MODEL_PATH = Path(__file__).resolve().parents[2] / "artifacts" / "classifier.joblib"

_model_cache: tuple[float, object] | None = None  # (mtime, pipeline)


def _trained_model():
    """Load (and cache) the trained pipeline; None when unavailable."""
    global _model_cache
    try:
        mtime = MODEL_PATH.stat().st_mtime
    except OSError:
        return None
    if _model_cache is not None and _model_cache[0] == mtime:
        return _model_cache[1]
    try:
        import joblib
        pipeline = joblib.load(MODEL_PATH)
    except Exception:  # missing deps or corrupt artifact → heuristic fallback
        return None
    _model_cache = (mtime, pipeline)
    return pipeline

CATEGORY_RULES: dict[IssueCategory, dict] = {
    IssueCategory.POTHOLE: {
        "label": "Pothole",
        "department_id": "dept-road",
        "department_name": "Road Maintenance",
        "keywords": ["pothole", "hole", "crater", "road hole", "sunken", "dip"],
        "severity": "HIGH",
        "sla": 72,
    },
    IssueCategory.ROAD_DAMAGE: {
        "label": "Road Damage",
        "department_id": "dept-road",
        "department_name": "Road Maintenance",
        "keywords": ["cracked", "crack", "broken road", "road edge", "rutting", "tar"],
        "severity": "MEDIUM",
        "sla": 96,
    },
    IssueCategory.WATER_LEAK: {
        "label": "Water Leak",
        "department_id": "dept-water",
        "department_name": "Water Supply",
        "keywords": ["leak", "leaking", "water", "burst pipe", "flooding", "dripping"],
        "severity": "HIGH",
        "sla": 24,
    },
    IssueCategory.GARBAGE: {
        "label": "Garbage / Waste",
        "department_id": "dept-sanitation",
        "department_name": "Sanitation",
        "keywords": ["garbage", "trash", "waste", "dump", "bin", "litter", "stink"],
        "severity": "MEDIUM",
        "sla": 48,
    },
    IssueCategory.STREETLIGHT: {
        "label": "Streetlight",
        "department_id": "dept-electrical",
        "department_name": "Electrical",
        "keywords": ["streetlight", "street light", "lamp", "dark", "flickering", "pole"],
        "severity": "LOW",
        "sla": 120,
    },
    IssueCategory.DRAINAGE: {
        "label": "Drainage",
        "department_id": "dept-drainage",
        "department_name": "Drainage",
        "keywords": ["drain", "sewage", "clogged", "manhole", "overflow", "gutter"],
        "severity": "HIGH",
        "sla": 48,
    },
}


class Classifier:
    """Provider interface (§26)."""

    def classify(self, description: str, seed_category: IssueCategory | None = None) -> ClassificationOut:
        raise NotImplementedError


class DemoClassifier(Classifier):
    def classify(self, description: str, seed_category: IssueCategory | None = None) -> ClassificationOut:
        if seed_category:
            rule = CATEGORY_RULES[seed_category]
            hits = [k for k in rule["keywords"] if k in description.lower()]
            return ClassificationOut(
                category=seed_category,
                category_label=rule["label"],
                department_id=rule["department_id"],
                department_name=rule["department_name"],
                severity=rule["severity"],
                confidence=92,
                matched_keywords=hits,
                summary=f"Report text matches {rule['label']} patterns handled by {rule['department_name']}.",
            )

        desc = description.lower()
        keyword_hits: dict[IssueCategory, list[str]] = {}
        for cat, rule in CATEGORY_RULES.items():
            keyword_hits[cat] = [k for k in rule["keywords"] if k in desc]

        pipeline = _trained_model()
        if pipeline is not None:
            proba = pipeline.predict_proba([description])[0]
            classes = list(pipeline.classes_)
            best_i = max(range(len(classes)), key=lambda i: proba[i])
            cat = IssueCategory(classes[best_i])
            confidence = max(1, min(99, round(float(proba[best_i]) * 100)))
            rule = CATEGORY_RULES[cat]
            hits = keyword_hits[cat]
            summary = (
                f"Trained text model (synthetic corpus) — {rule['label']} at "
                f"{confidence}% probability; routed to {rule['department_name']}."
            )
            return ClassificationOut(
                category=cat,
                category_label=rule["label"],
                department_id=rule["department_id"],
                department_name=rule["department_name"],
                severity=rule["severity"],
                confidence=confidence,
                matched_keywords=hits,
                summary=summary,
            )

        best: tuple[IssueCategory, list[str]] | None = None
        for cat, hits in keyword_hits.items():
            if hits and (best is None or len(hits) > len(best[1])):
                best = (cat, hits)

        if best is None:
            cat, hits = IssueCategory.POTHOLE, []
            confidence = 38
            summary = "No strong keyword match — classified by default taxonomy entry for review."
        else:
            cat, hits = best
            confidence = min(95, 55 + len(hits) * 14)
            summary = f"Matched {len(hits)} keyword(s): {', '.join(hits)}."

        rule = CATEGORY_RULES[cat]
        return ClassificationOut(
            category=cat,
            category_label=rule["label"],
            department_id=rule["department_id"],
            department_name=rule["department_name"],
            severity=rule["severity"],
            confidence=confidence,
            matched_keywords=hits,
            summary=summary,
        )


classifier = DemoClassifier()
