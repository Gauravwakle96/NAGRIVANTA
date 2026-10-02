"""Train the Nagrivanta issue classifier.

    cd backend
    ./venv/Scripts/python train_classifier.py

Writes backend/artifacts/classifier.joblib + classifier_metrics.json.
The API picks the artifact up automatically (keyword heuristic stays as
fallback when it is absent).
"""

from app.services.training import main

if __name__ == "__main__":
    main()
