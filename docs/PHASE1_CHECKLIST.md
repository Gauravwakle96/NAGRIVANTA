# Phase 1 — Definition of Done Checklist

Status of every item in the Phase 1 (Core MVP) spec, with how it was verified.
All items: **done**.

---

## Citizen

| Item | Status | Verified by |
|------|--------|-------------|
| Landing page (hero, workflow, nav) | ✅ | browser, desktop + mobile |
| Report issue wizard (photo → location → description) | ✅ | guided demo step 1 + report page |
| Image upload (camera/drag-drop, preview, retake, remove) | ✅ | ImageUploader validation: type, size, corrupt |
| Location selection (browser, map pin, manual, denial handled) | ✅ | LocationPicker |
| Description step ("What happened?") | ✅ | ReportWizard |
| AI/demo classification shown | ✅ | step 2; classification card marked *demo/simulated* |
| Trust result with factors | ✅ | step 3; issue page TRUST panel |
| Duplicate detection + warning | ✅ | step 4; report wizard duplicate warning |
| Explainable priority | ✅ | step 6; issue page WHY? panel with factor math |
| Submit report → issue ID | ✅ | step 1 → `NGV-1021` |
| Track issue (search by id) | ✅ | TrackIssue page |
| Issue timeline | ✅ | issue detail timeline |
| Issue detail (trust/priority/duplicates/reports/audit) | ✅ | `/issues/NGV-1021` |

## Intelligence

| Item | Status | Verified by |
|------|--------|-------------|
| Classification service | ✅ | `test_classification_unit` + trained-model tests (99.8% held-out, heuristic fallback) |
| Trust service | ✅ | acceptance assertions |
| Duplicate service | ✅ | `test_duplicate_detection_unit` (≥7 matches) |
| Priority service | ✅ | acceptance assertions |
| Explainable reasoning (factor lists everywhere) | ✅ | UI + API payloads |

## Municipal

| Item | Status | Verified by |
|------|--------|-------------|
| Command center (KPIs, recent issues) | ✅ | browser, desktop + mobile |
| Issue list + filters (status/category/department/priority/search) | ✅ | IssueList page |
| Issue detail | ✅ | shared citizen/municipal view |
| Interactive map (Leaflet + fallback tiles) | ✅ | CityMap / RiskMap |
| Work-order creation | ✅ | WorkOrders page; acceptance step 8 |
| Department assignment | ✅ | acceptance step 7 |
| Crew assignment | ✅ | acceptance step 8 (`crew-road-a`) |

## Field crew

| Item | Status | Verified by |
|------|--------|-------------|
| Crew dashboard (today's jobs) | ✅ | CrewDashboard |
| Job detail | ✅ | CrewJob |
| Before evidence upload | ✅ | acceptance step 9 |
| After evidence upload | ✅ | acceptance step 10 |
| Repair submission | ✅ | `mark-repaired` + `submit-repair` |

## Verification

| Item | Status | Verified by |
|------|--------|-------------|
| Before/after comparison UI | ✅ | VerificationQueue side-by-side proof |
| Verification result (5-check engine) | ✅ | acceptance: `5/5 checks passing` |
| Resolved | ✅ | issue + work order → RESOLVED, `closedAt` set |
| Reinspection required | ✅ | `REINSPECTION_REQUIRED` path in engine + UI action |

## Prediction

| Item | Status | Verified by |
|------|--------|-------------|
| Synthetic historical dataset | ✅ | seeded risk zones/predictions |
| Predictive risk engine | ✅ | acceptance step 17 (7/30/90-day horizons) |
| Risk map | ✅ | RiskIntelligence + RiskMap pages |

## Reliability

| Item | Status | Verified by |
|------|--------|-------------|
| DEMO MODE (works with zero external services) | ✅ | API-down fallback to demo provider; mode badge |
| Loading states | ✅ | shared `LoadingState` on every async view |
| Empty states | ✅ | shared `EmptyState` |
| Error states | ✅ | shared `ErrorState` + toast errors |
| Responsive layouts | ✅ | mobile 390 px + desktop 1440 px browser pass |
| Basic role-aware navigation | ✅ | `ROUTE_ROLES` + `RequireRole`; server 403 asserted |
| Browser-safe production build | ✅ | `npm run build` (tsc -b && vite build) green |

## §6 Acceptance scenario (the gate)

| Requirement | Status |
|-------------|--------|
| 7 similar reports found → master issue ≥ 8 reports | ✅ |
| Priority calculated + reasoning displayed | ✅ |
| Officer → department → crew → work order | ✅ |
| Before → repair → after → verification → resolved | ✅ |
| Citizen sees updated status | ✅ |
| Risk engine displays future risk | ✅ |
| Enforced by automated test | ✅ `test_full_acceptance_scenario` |
| Executable from UI (judge mode) | ✅ `/demo` — 13/13 steps, live API |

## Quality gates

| Gate | Result |
|------|--------|
| `pytest tests/` | 6/6 passed |
| `npm run lint` | 0 errors (14 warnings — React Compiler advisories) |
| `npx tsc -b` | 0 errors, strict |
| `npm run build` | green, code-split |
| Browser console | 0 errors across landing, demo, command, issue, verification |

---

## Not in Phase 1 (by design)

Phase 2 polish (command palette, SLA timers, escalation, localization, PWA…) and
Phase 3 integrations (ERP, Open311, SMS, IoT…) are **not started**. Provider
seams exist; nothing is faked as integrated.
