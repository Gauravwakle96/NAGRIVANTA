# NAGRIVANTA

### City Civic Intelligence Platform

**Report → Understand → Trust → Merge → Prioritize → Assign → Fix → Verify → Predict → Prevent**

Nagrivanta is a civic operations platform: a citizen reports a problem with a photo,
location and one line of description, and the platform classifies it, scores how
trustworthy it is, merges it with duplicate reports into a single master issue,
calculates an explainable priority, routes it to a department and crew, tracks the
repair with before/after photographic proof, verifies the result, and predicts where
the next problem will appear.

Phase 1 (Core MVP) is complete and runs fully locally with **no external services** —
no AI keys, no cloud database, no network dependencies beyond npm/pip installs.

---

## Quick start

### 1. Backend (FastAPI + SQLite)

```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # or: pip install -r requirements.txt
venv/Scripts/python -m uvicorn app.main:app --port 8000
```

The database (`nagrivanta.db`) is created and deterministically seeded on first start.

### 2. Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

The UI is **API-first**: it calls the FastAPI backend at `http://localhost:8000` and
silently falls back to a local demo provider (persisted in `localStorage`) whenever the
API is unreachable. Either way the app works — the header badge shows which mode is live
(`LIVE API` / `DEMO MODE`).

### 3. Run the guided demo

Open **/demo** and press **Run full scenario**. This executes the complete §6
acceptance scenario as real service calls — one citizen pothole report at MG Road
merges with 7 nearby reports, becomes one master issue, gets an explained CRITICAL
priority, is assigned to Road Maintenance, dispatched as a work order, repaired with
before/after evidence, verified 5/5, resolved, and fed into the risk engine.

---

## Testing & quality gates

```bash
# Backend — includes the full §6 acceptance scenario as an executable test
cd backend && rm -f nagrivanta.db && venv/Scripts/python -m pytest tests/ -q

# Frontend
cd frontend
npm run lint        # oxlint — 0 errors
npx tsc -b          # strict TypeScript — 0 errors
npm run build       # production build (tsc -b && vite build)
```

---

## Training the classifier

The API's issue classifier is a **trained model** (TF-IDF + logistic
regression), not just keywords. It learns from a locally generated synthetic
corpus of varied civic-report phrasings and keeps the keyword heuristic as an
automatic fallback:

```bash
cd backend
./venv/Scripts/python train_classifier.py
```

Result: **99.8% held-out accuracy** (480 test samples, macro F1 0.998) across
the 6 categories. Artifacts land in `backend/artifacts/`:

- `classifier.joblib` — the fitted pipeline (picked up by the running API, no restart needed)
- `classifier_metrics.json` — accuracy, per-class F1, provenance

Retraining is deterministic (seeded). The API keeps marking classifications
`simulated: true` — the model learned from generated data, not real civic
history, and the UI never claims otherwise. Tests in
`backend/tests/test_classifier_model.py` enforce the accuracy floor, the
paraphrase behaviour, and the heuristic fallback.

---

## Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 19, TypeScript (strict), Vite, Tailwind CSS 4, shadcn/ui, React Router 7, TanStack Query, Zustand, Leaflet/React-Leaflet, Recharts, Framer Motion, Zod, React Hook Form |
| Backend   | FastAPI, SQLAlchemy 2, Pydantic 2, SQLite (PostgreSQL/PostGIS-ready schema) |
| Storage   | SQLite locally → `DATABASE_URL` points at PostgreSQL/Supabase for deployment |
| Auth      | Demo role-session (local) + server-side role checks on every mutating route |
| AI        | Trained text classifier (scikit-learn, synthetic corpus, 99.8% held-out) with keyword-heuristic fallback; deterministic trust/duplicate/priority/verification/risk engines — all marked `simulated` / `demo` in the UI |

---

## Repository layout

```
frontend/           React SPA
  src/
    components/     shared UI, layout shell, states, issue pieces
    pages/          landing, citizen, municipal, crew, guided demo
    routes/         role guards
    services/       NagrivantaService contract, engines, demo + API providers, registry
    stores/         session (role sign-in)
    types/          domain model shared by every layer
backend/
  app/
    api/            routers + serializers (camelCase contract)
    core/           config, database, security (role deps), seed
    models/         SQLAlchemy entities
    schemas/        Pydantic request/response contracts
    services/       classifier, trust, duplicate, priority, routing,
                    verification, prediction, notifications, audit
  tests/            §6 acceptance scenario + unit tests
docs/               architecture, demo scenario, phase 1 checklist
```

---

## What makes it different

| Step | Typical civic app | Nagrivanta |
|------|-------------------|------------|
| Trust | Accepts every report | Scores evidence, location, corroboration — explainable |
| Duplicates | Each report stands alone | Merges 8 reports into 1 master issue, evidence preserved |
| Priority | Fixed rules | Weighted, factor-by-factor explainable score |
| Verification | Trusts the crew's word | Before/after photo proof + 5-check engine |
| Prediction | None | Synthetic risk engine: where will the next problem appear? |

---

## Phase status

- **Phase 1 (Core MVP)** — ✅ complete. See [docs/PHASE1_CHECKLIST.md](docs/PHASE1_CHECKLIST.md).
- **Phase 2 (Polish)** — not started (by design).
- **Phase 3 (Integrations)** — interface/provider boundaries only; nothing faked.

Docs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DEMO_SCENARIO.md](docs/DEMO_SCENARIO.md)

> All data is synthetic. Predictions and AI classifications are simulated heuristics,
> labeled as such in the UI. Demo authentication collects no credentials.
