# The §6 Acceptance Scenario — DEMO_SCENARIO

The primary acceptance scenario from the build spec, as it actually executes.

**Run it yourself:** start backend + frontend, open **/demo**, press
**Run full scenario**. 13 steps, ~15 seconds, real service calls against the live
provider (or the demo provider if the API is down — same contract).

The same flow is enforced by `backend/tests/test_acceptance.py`
(`test_full_acceptance_scenario`) so it cannot silently rot.

---

## The flow

| # | Step | What actually happens | Evidence on screen |
|---|------|-----------------------|--------------------|
| 1 | Citizen reports pothole | `POST /api/reports` at MG Road (18.52063, 73.85671) with a photo data-URL | `Report RPT-9008 accepted → NGV-1021 — now holds 8 reports` |
| 2 | AI identifies pothole | keyword classifier → `POTHOLE` → Road Maintenance, severity HIGH, 83% (marked *demo*) | `Pothole → Road Maintenance · severity HIGH · confidence 83% (demo)` |
| 3 | Trust check | evidence + location + corroboration score, factors listed | `98% · LIKELY GENUINE — Photo evidence attached · Location provided · …` |
| 4 | Duplicate detection | 350 m radius + category + description similarity | `7 similar reports found — nearest match 58 m away` |
| 5 | Master issue created | 1 new + 7 pending = **8 reports → 1 master issue**, evidence preserved, `DuplicateCluster` row | `8 reports → 1 master issue → work order pending · 5 unique photos · 2 days active` |
| 6 | Priority calculated | weighted factors, every point attributable | `CRITICAL · 96/100 — 8 reports in cluster +30 · arterial corridor +16 · safety +12 …` |
| 7 | Department assigned | officer routes to Road Maintenance, status → TRIAGED | `Road Maintenance — NGV-1021 status → TRIAGED` |
| 8 | Work order created | SLA computed from category, crew dispatched, status → ASSIGNED | `WO-0021 → Road Team A — SLA due …` |
| 9 | Crew accepts & BEFORE | transitions ACCEPTED → DISPATCHED → IN_PROGRESS, before-evidence uploaded | `BEFORE evidence uploaded — WO-0021 on site · IN PROGRESS` |
| 10 | Repair + AFTER | `mark-repaired`, after-evidence, `submit-repair` → REPAIR_SUBMITTED | `AFTER evidence uploaded · repair submitted` |
| 11 | Verification | inspector runs the 5-check engine on before/after proof | `RESOLVED · 5/5 checks passing` |
| 12 | Citizen sees resolved | fresh `GET /api/issues/NGV-1021` → `RESOLVED`, timeline + notification | `NGV-1021 → RESOLVED — Citizen timeline updated end-to-end` |
| 13 | Risk prediction | 30-day horizon for the MG Road corridor (simulated) | `MG Road: risk 92 → 68 (HIGH) — Surface condition survey on the corridor…` |

---

## The 4 differentiators, as executed

1. **Trust** — step 3: nothing is accepted blindly; the report earns a 98% score
   from named factors (photo +34, pin +24, descriptive +18, known reporter +10).
2. **Duplicate merging** — steps 4–5: 7 neighbouring reports collapse into one
   master issue instead of 8 separate tickets.
3. **Explainable priority** — step 6 + the issue page "WHY?" panel: every point
   is a labeled factor; the score is never an unexplained number.
4. **Verification proof** — steps 9–11: the repair is only trusted because the
   crew uploaded BEFORE and AFTER photos and the inspector's 5-check engine
   passed — never on the crew's word alone.

---

## What the judge can verify independently

- **Issue page** (`/issues/NGV-1021`): WHY? panel with factor math, TRUST panel,
  DUPLICATES rollup (8 reports / 5 photos / 2 days), full timeline, all 8 merged
  report cards, and the audit trail showing every intelligence stage
  (AI analysis → Trust → Duplicate cluster → Priority → Department → Crew →
  Evidence → Verification → Resolved).
- **Verification page** (`/app/verification`, Inspector role): side-by-side
  BEFORE/AFTER proof with per-check pass/fail and Accept / Require-reinspection.
- **Audit log** (`/app/city/audit`): append-only, actor + role per event.
- **Backend test**: `cd backend && rm -f nagrivanta.db && venv/Scripts/python -m pytest tests/ -q`
  runs the entire scenario headlessly, including a CITIZEN-actor 403 check.

---

## Reset

**Reset demo data** on `/demo` (or `POST /api/reset`) drops and re-seeds the
database: the MG Road pending cluster returns to 7 un-merged reports and the next
run produces the same story from scratch. Deterministic by design.
