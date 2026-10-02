"""Text classifier training — synthetic data → TF-IDF + logistic regression.

Honesty contract (§26/§32): the dataset is generated locally from varied
paraphrase banks (no external data), the artifact records that provenance in
`classifier_metrics.json`, and the API keeps marking classifications
`simulated: true`. The keyword heuristic in `classifier.py` remains the
fallback when the artifact is absent or scikit-learn is not installed.

Train / retrain:

    cd backend && ./venv/Scripts/python train_classifier.py

Artifacts land in `backend/artifacts/`:
    classifier.joblib          trained Pipeline(vectorizer, classifier)
    classifier_metrics.json    accuracy, per-class F1, provenance
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "classifier.joblib"
METRICS_PATH = ARTIFACTS_DIR / "classifier_metrics.json"

RANDOM_SEED = 20261002
SAMPLES_PER_CATEGORY = 400
MIN_ACCEPTABLE_ACCURACY = 0.85

# ---------------------------------------------------------------------------
# Synthetic dataset — paraphrase banks per category (deliberately wider than
# the keyword heuristic so the model must generalise, not memorise).
# ---------------------------------------------------------------------------

PHRASES: dict[str, list[str]] = {
    "POTHOLE": [
        "deep pothole", "big pothole", "pothole", "hole in the road",
        "huge hole on the road", "crater in the road", "sunken patch on the road",
        "road has caved in", "cave-in on the road", "dip in the road",
        "gaddha on the road", "road caved in near the junction",
    ],
    "ROAD_DAMAGE": [
        "road is cracked", "cracked pavement", "cracks on the road surface",
        "road surface broken", "loose gravel on the road", "road edge crumbling",
        "tarmac coming off", "tar peeling off", "road is rutting",
        "speed breaker worn out", "road is breaking apart", "broken tarmac",
    ],
    "WATER_LEAK": [
        "water leaking", "water leaking from the pipe", "leaking pipe",
        "burst pipe", "water pipe burst", "water flowing across the road",
        "water gushing from a pipe", "constant water leakage",
        "water wastage from a broken main", "tap leaking", "paani leaking",
        "water streaming from an underground pipe",
    ],
    "GARBAGE": [
        "garbage not collected", "pile of garbage", "trash not picked up",
        "overflowing garbage bin", "garbage dumped on the road",
        "waste strewn around", "litter piling up", "stinking garbage",
        "kachra lying around", "bin overflowing with waste", "rotting waste",
        "garbage heap near the corner",
    ],
    "STREETLIGHT": [
        "streetlight not working", "street light not working", "lamp post is dark",
        "light on the pole is out", "flickering streetlight", "streetlight flickering",
        "no light at night", "dark stretch at night", "pole light broken",
        "street lamp not glowing", "streetlight dead since evening",
    ],
    "DRAINAGE": [
        "drain clogged", "clogged drain", "blocked drain", "sewage overflowing",
        "sewage overflow", "manhole overflowing", "gutter blocked",
        "water stagnating in the drain", "drain water overflowing",
        "sewage smell from the drain", "drainage blocked", "choked drain",
    ],
}

DEPARTMENT_OF = {
    "POTHOLE": ("dept-road", "Road Maintenance"),
    "ROAD_DAMAGE": ("dept-road", "Road Maintenance"),
    "WATER_LEAK": ("dept-water", "Water Supply"),
    "GARBAGE": ("dept-sanitation", "Sanitation"),
    "STREETLIGHT": ("dept-electrical", "Electrical"),
    "DRAINAGE": ("dept-drainage", "Drainage"),
}

LOCATIONS = [
    "MG Road", "Station Road", "near the bus stop", "near the community hall",
    "in the market area", "near the bridge approach", "by the school gate",
    "at the railway crossing", "near the main square", "at the hospital corner",
    "in the industrial estate", "near Ward 4 office", "on the flyover approach",
    "behind the bus depot", "near the post office",
]

IMPACTS = [
    "cars are swerving", "bikes are losing balance", "very dangerous for pedestrians",
    "kids play here every evening", "getting worse every day",
    "been like this for two days", "traffic is badly affected",
    "people are struggling to pass", "accidents waiting to happen",
    "elderly cannot walk safely",
]

ACTIONS = [
    "please fix urgently", "needs immediate attention", "kindly repair this",
    "issue needs action", "requesting quick repair", "please send a team",
]

TEMPLATES = [
    "{phrase} at {loc}",
    "{loc} — {phrase}",
    "{phrase} near {loc}, {impact}",
    "Sir, {phrase} at {loc}. {impact}",
    "{loc}: {phrase}. {impact}. {action}",
    "please fix the {phrase} at {loc} {action}",
    "issue: {phrase} {loc}",
    "{phrase} {loc}, {impact}, {action}",
    "hello, {phrase} at {loc}!!",
    "{phrase}. {impact}",
]

_NOISE_WORDS = ["hello", "urgent", "please", "team", "respected", "sir"]
_CATEGORIES = list(PHRASES)


def _typo(word: str, rng: random.Random) -> str:
    """Occasional single-character typo so the model tolerates noisy input."""
    if len(word) < 4 or rng.random() > 0.12:
        return word
    i = rng.randrange(1, len(word) - 1)
    mode = rng.random()
    if mode < 0.5:
        return word[:i] + word[i + 1:]
    if mode < 0.8:
        return word[:i] + word[i] + word[i:]
    return word[:i] + rng.choice("abcdefghijklmnopqrstuvwxyz") + word[i + 1:]


def build_dataset() -> tuple[list[str], list[str]]:
    """Deterministic synthetic corpus: (descriptions, labels)."""
    rng = random.Random(RANDOM_SEED)
    texts: list[str] = []
    labels: list[str] = []
    for label in _CATEGORIES:
        phrases = PHRASES[label]
        for _ in range(SAMPLES_PER_CATEGORY):
            phrase = rng.choice(phrases)
            if rng.random() < 0.35:
                phrase = " ".join(_typo(w, rng) if rng.random() < 0.4 else w
                                  for w in phrase.split())
            text = rng.choice(TEMPLATES).format(
                phrase=phrase,
                loc=rng.choice(LOCATIONS),
                impact=rng.choice(IMPACTS),
                action=rng.choice(ACTIONS),
            )
            if rng.random() < 0.15:
                text = rng.choice(_NOISE_WORDS) + ", " + text[0].lower() + text[1:]
            if rng.random() < 0.2:
                text = text.upper() if rng.random() < 0.5 else text.swapcase()
            texts.append(text)
            labels.append(label)
    # shuffle before the split so stratification sees mixed order
    order = list(range(len(texts)))
    rng.shuffle(order)
    return [texts[i] for i in order], [labels[i] for i in order]


# ---------------------------------------------------------------------------
# Train / load
# ---------------------------------------------------------------------------

def train_model() -> dict:
    """Train the pipeline, evaluate on a held-out split, write artifacts."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, classification_report
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline

    texts, labels = build_dataset()
    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels,
    )

    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2), min_df=1, sublinear_tf=True, strip_accents="unicode",
        )),
        ("clf", LogisticRegression(max_iter=1000, class_weight="balanced",
                                   random_state=42)),
    ])
    pipe.fit(x_train, y_train)

    y_pred = pipe.predict(x_test)
    accuracy = float(accuracy_score(y_test, y_pred))
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

    metrics = {
        "algorithm": "tfidf + logistic_regression",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "data": "synthetic (generated locally, paraphrase banks — no external corpus)",
        "random_seed": RANDOM_SEED,
        "n_samples": len(texts),
        "n_train": len(x_train),
        "n_test": len(x_test),
        "test_accuracy": round(accuracy, 4),
        "per_class_f1": {c: round(report[c]["f1-score"], 4) for c in _CATEGORIES},
        "macro_f1": round(report["macro avg"]["f1-score"], 4),
        "simulated": True,
    }

    if accuracy < MIN_ACCEPTABLE_ACCURACY:
        raise RuntimeError(
            f"trained accuracy {accuracy:.3f} below acceptance threshold "
            f"{MIN_ACCEPTABLE_ACCURACY} — artifact not written"
        )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    import joblib
    joblib.dump(pipe, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


def load_metrics() -> dict | None:
    try:
        return json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def ensure_trained(force: bool = False) -> dict:
    """Return metrics, training first when the artifact is missing (or forced)."""
    if not force:
        metrics = load_metrics()
        if metrics and MODEL_PATH.exists():
            return metrics
    return train_model()


def main() -> None:
    print("Training civic issue classifier on synthetic data…")
    metrics = ensure_trained(force=True)
    print(f"  samples      : {metrics['n_samples']} "
          f"({metrics['n_train']} train / {metrics['n_test']} test)")
    print(f"  test accuracy: {metrics['test_accuracy']:.2%}")
    print(f"  macro F1     : {metrics['macro_f1']:.4f}")
    for cat, f1 in metrics["per_class_f1"].items():
        print(f"    {cat:<12} F1 {f1:.4f}")
    print(f"  artifact     : {MODEL_PATH}")
    print(f"  metrics      : {METRICS_PATH}")


if __name__ == "__main__":
    main()
