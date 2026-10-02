# Nagrivanta — Architecture

Phase 1 implementation of the platform described in the build spec. This document
describes what exists in the repository today, not aspirations.

---

## 1. System overview

```
                NAGRIVANTA
                     |
        +------------+------------+
        |            |            |
      Citizen      Crew        Municipal
      Portal      Portal       Command
        |            |            |
        +------------+------------+
                     |
           UI service contract
          (NagrivantaService)
                     |
        +------------+------------+
        |                         |
   ApiProvider              DemoDataProvider
   (FastAPI + SQLite)       (localStorage, seeded)
        |                         |
        +------------+------------+
                     |
              Nagrivanta API
                     |
   +---------+-------+-------+----------+----------+
   |         |               |          |          |
 Reports   Trust        Duplicates   Priority   Verification
   |         |               |          |          |
   +---------+---------------+----------+----------+
                     |
               Risk prediction  →  Risk map
```

Three portals (citizen, field crew, municipal command) sit on one service contract.
Business logic lives behind that contract so the UI never knows — or cares — whether
it is talking to the API, the local demo store, or (later) Supabase.

---

## 2. The service contract

`frontend/src/services/types.ts` defines `NagrivantaService`: every read
(`listIssues`, `getIssue`, `listWorkOrders`, …), every intelligence call
(`classify`, `checkDuplicates`), and every mutation (`submitReport`,
`assignDepartment`, `createWorkOrder`, `transitionWorkOrder`, `uploadEvidence`,
`markRepaired`, `submitRepair`, `recordVerification`, …).

Two implementations:

| Provider | Backing | When used |
|----------|---------|-----------|
| `ApiProvider` | FastAPI at `API_BASE_URL` | API is reachable (health probe) |
| `DemoDataProvider` | `localStorage` (`nagrivanta.demo.v1`), deterministic seed | API unreachable, or offline demo |

`services/registry.ts` picks API-first and falls back silently per call. The shell
displays the active mode (`LIVE API` / `DEMO MODE`) so nobody is misled.

**Rule:** both providers must satisfy the same contract and the same domain types
(`types/domain.ts`). The acceptance test exercises the API provider; the guided demo
works against either.

---

## 2.1 Wire format

API responses are **camelCase**, matching `types/domain.ts` exactly:

- `backend/app/api/serializers.py` — ORM → camelCase dicts (`issue_out`,
  `work_order_out`, `audit_out`, …).
- `backend/app/schemas/` — Pydantic models use `Field(alias=…)` +
  `populate_by_name` so engines construct with Python snake_case while
  `model_dump(by_alias=True)` emits the frontend contract.
- Mutating requests declare their actor as flat `actorId` / `actorRole` fields
  (`ApiProvider.actorBody`).

A contract change must land in domain types, both providers, serializers/schemas
and the backend tests **in the same change** — the acceptance test is the guard.

---

## 3. Backend (FastAPI)

```
backend/app/
  core/
    config.py      env-driven settings (DATABASE_URL, demo flags, provider seams)
    database.py    SQLAlchemy engine/session; SQLite locally, PostgreSQL via DATABASE_URL
    security.py    demo identity (X-User-Id / X-Role headers) + role dependencies
    seed.py        deterministic seed: departments, crews, zones, statuses, MG Road cluster
  models/          Issue, Report, Evidence, WorkOrder, TrustScore, PriorityScore,
                   DuplicateCluster, VerificationRecord, RiskZone, RiskPrediction,
                   Notification, AuditLog, …
  schemas/         request/response contracts (camelCase aliases)
  services/        classifier, trust, duplicate, priority, routing, verification,
                   prediction, notifications, audit — pure, testable, no HTTP
  api/             thin routers: reports, issues, work_orders, verification,
                   risk, analytics, notifications, auth + serializers
  main.py          app factory, lifespan seed, /api/health, /api/reset
```

### Submission pipeline (`POST /api/reports`)

classify → trust → duplicates → merge-or-create master issue → priority →
audit events → notifications → full result payload (report, issue,
classification, trust, duplicates, priority, `mergedIntoExisting`).

Duplicate merge logic: matches with an existing issue id are absorbed into the
dominant master; matches without one (the seeded pending cluster) are absorbed
into the newly created master. `DuplicateCluster` records the rollup.

### PostGIS migration path

Issues/reports store plain `lat`/`lng` floats. Swapping to
`geography("Point", srid=4326)` + a GIST index only touches the column types;
query code reads `.lat`/`.lng` properties, so call sites don't change.

---

## 4. Authorization

Two layers, both enforced on every mutating municipal route:

1. **Header identity (demo)** — `X-User-Id` / `X-Role`, standing in until a real
   identity provider (Supabase Auth) plugs into the same `get_current_user`
   signature. Absent headers fall back to a permissive demo default.
2. **Body-declared actor** — `ensure_actor_role(body.actor_role, …)` in
   `core/security.py` verifies the role the request *claims* against the route's
   tier (`STAFF_ROLES`, `CREW_ACCESS_ROLES`, `INSPECTOR_ACCESS_ROLES`). A
   `CITIZEN` actor can never create a work order or verify a repair, regardless
   of headers. The acceptance test asserts this with a 403.

Client-side, `RequireRole` route guards + `ROUTE_ROLES` gate navigation per role
(CITIZEN, FIELD_CREW, INSPECTOR, DEPARTMENT_OFFICER, SUPERVISOR, CITY_ADMIN,
CITY_LEADERSHIP). Guards are UX; the server is authority.

---

## 5. Frontend

```
frontend/src/
  types/domain.ts        the shared vocabulary (camelCase, matches API 1:1)
  services/
    engines.ts           pure classification/trust/duplicate/priority/verification logic
    demo/seed.ts         deterministic dataset (mulberry32, SEED=20261002)
    demo/demoProvider.ts NagrivantaService over localStorage
    api/apiProvider.ts   NagrivantaService over fetch
    registry.ts          API-first, silent fallback, mode badge
    risk.ts              predictive risk engine (synthetic)
  stores/session.ts      demo role sign-in, ROUTE_ROLES, canAccess()
  routes/guards.tsx      RequireRole
  components/layout/     AppShell, nav model, sidebar
  pages/                 Landing, ReportWizard, IssueDetail, CommandCenter,
                         WorkOrders, VerificationQueue, RiskIntelligence,
                         CrewDashboard, GuidedDemo, …
```

State: TanStack Query for server state, Zustand for the session. Routing is
role-aware; every data page has loading / empty / error states.

---

## 6. Provider seams (Phase 3 boundaries, not faked)

Interfaces exist; only demo implementations are wired:

| Seam | Interface | Demo impl | Future |
|------|-----------|-----------|--------|
| AI classification | `Classifier.classify` | **trained** TF-IDF + logreg on synthetic corpus (`training.py`), keyword heuristic as fallback, `simulated: true` | external ML |
| Notifications | `NotificationProvider` setting | in-app rows | email / SMS / WhatsApp |
| Identity | `get_current_user` signature | header role assertion | Supabase Auth |
| Database | `DATABASE_URL` | SQLite | PostgreSQL/PostGIS |
| Realtime | REST today | — | WebSocket-ready by contract split |

No future integration is presented as working.

---

## 7. Determinism

- Seed is a fixed dataset (no randomness at import).
- Demo provider uses `mulberry32` with `SEED = 20261002`.
- The guided demo runs real service calls, so re-running it against the API
  appends to (not overwrites) history — "Reset demo data" re-seeds.
- Backend tests delete `nagrivanta.db` first so seeding is fresh every run.
- The classifier trains from a seeded synthetic corpus
  (`RANDOM_SEED = 20261002`) — `train_classifier.py` reproduces the same
  artifact byte-for-byte across runs on the same library versions.

---

## 7.1 The trained classifier

`app/services/training.py` generates ~2,400 labeled descriptions from
paraphrase banks (deliberately wider than the keyword list, including
transliterations and typos), fits a `TfidfVectorizer(1–2 grams) +
LogisticRegression` pipeline on an 80/20 stratified split, and refuses to write
the artifact below the 85% acceptance threshold. The checked result: **99.8%
held-out accuracy**.

At request time `classifier.py` lazily loads `artifacts/classifier.joblib`
(cached by mtime, so a retrain is picked up without restarting the API). If the
artifact or scikit-learn is missing, the deterministic keyword heuristic takes
over — the route contract and `simulated: true` flag never change either way.

---

## 8. Testing strategy

| Layer | Tool | What |
|-------|------|------|
| Backend | pytest | full §6 acceptance scenario end-to-end + duplicate/classify/validation/stats units |
| Frontend | oxlint, `tsc -b`, `vite build` | 0 errors (strict TS) |
| E2E (manual) | Guided Demo page | 13 steps against the live API, judge mode |

The §6 scenario in `backend/tests/test_acceptance.py` is the executable definition
of done: report → 7 duplicates → master → priority → department → crew → work
order → before → repair → after → verification (5/5) → resolved → citizen view →
risk — plus a 403 role-enforcement check.
