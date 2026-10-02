"""Trained classifier: artifact, accuracy floor, prediction quality, fallback.

Guards the model-integration contract (§26): the artifact must exist and meet
the accuracy threshold, predictions must handle paraphrases the keyword
heuristic cannot match, and the heuristic must remain a working fallback when
the model is unavailable.
"""

from app.models.entities import IssueCategory
from app.services import training
from app.services.classifier import classifier


def test_artifact_meets_accuracy_floor():
    metrics = training.ensure_trained()
    assert metrics["test_accuracy"] >= training.MIN_ACCEPTABLE_ACCURACY
    assert metrics["n_train"] >= 1000
    assert metrics["data"].startswith("synthetic")
    assert metrics["simulated"] is True
    assert set(metrics["per_class_f1"]) == set(training.PHRASES)


def test_model_handles_paraphrases_without_keywords():
    """Inputs with no heuristic keywords must still classify correctly."""
    training.ensure_trained()
    paraphrases = {
        "the road has caved in near the flyover, cars are swerving": IssueCategory.POTHOLE,
        "light on the pole is out at the market, dangerous at night": IssueCategory.STREETLIGHT,
        "sewage smell from the drain near the school gate": IssueCategory.DRAINAGE,
        "water gushing from a pipe on Station Road": IssueCategory.WATER_LEAK,
        "kachra lying around behind the bus depot": IssueCategory.GARBAGE,
        "tarmac is peeling off on the bridge approach": IssueCategory.ROAD_DAMAGE,
    }
    for text, expected in paraphrases.items():
        out = classifier.classify(text)
        assert out.category == expected, f"{text!r} → {out.category} (wanted {expected})"
        assert 1 <= out.confidence <= 99
        assert out.simulated is True  # synthetic corpus — never claimed real
        assert out.department_id and out.department_name


def test_seed_category_override_wins_over_model():
    training.ensure_trained()
    out = classifier.classify("random text", seed_category=IssueCategory.GARBAGE)
    assert out.category == IssueCategory.GARBAGE
    assert out.confidence == 92


def test_keyword_fallback_when_model_unavailable(monkeypatch):
    """No artifact / no sklearn → the deterministic heuristic still serves."""
    monkeypatch.setattr("app.services.classifier._trained_model", lambda: None)
    out = classifier.classify("water leaking from the pipe")
    assert out.category == IssueCategory.WATER_LEAK
    assert out.department_id == "dept-water"
    assert out.matched_keywords
    assert out.simulated is True
