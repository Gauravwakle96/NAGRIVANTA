"""§6 acceptance scenario as an executable test.

Citizen report → classify → trust → duplicates (7 nearby) → master issue →
priority → department → crew + work order → before → repair → after →
verification → resolved → citizen sees resolved → risk prediction.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client: TestClient):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["demo_mode"] is True


def test_full_acceptance_scenario(client: TestClient):
    # --- Citizen submits a pothole report at MG Road (inside 7-report cluster)
    submit = client.post("/api/reports", json={
        "description": "Deep pothole on MG Road near the bus stop, cars swerving to avoid it.",
        "point": {"lat": 18.52063, "lng": 73.85671},
        "address": "MG Road, Ward 4 · MG Road",
        "imageDataUrl": "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
        "submittedBy": "u-citizen-1",
    })
    assert submit.status_code == 201, submit.text
    payload = submit.json()

    issue = payload["issue"]
    issue_id = issue["id"]
    classification = payload["classification"]
    trust = payload["trust"]
    duplicates = payload["duplicates"]
    priority = payload["priority"]

    # 1-4: classification, trust, duplicate detection
    assert classification["category"] == "POTHOLE"
    assert classification["departmentName"] == "Road Maintenance"
    assert classification["simulated"] is True
    assert trust["score"] >= 55
    assert isinstance(trust["factors"], list) and len(trust["factors"]) >= 3

    # 5: "7 similar reports found" — seeded pending cluster at MG Road
    assert duplicates["matchedCount"] >= 7, f"expected >=7 duplicates, got {duplicates['matchedCount']}"

    # 6: master issue created with all reports merged
    assert len(issue["reportIds"]) >= 8, f"expected >=8 reports in master, got {len(issue['reportIds'])}"
    assert payload["mergedIntoExisting"] is False

    # 7-8: priority calculated with explanation
    assert priority["score"] > 0
    assert priority["level"] in ("HIGH", "CRITICAL", "MEDIUM", "LOW")
    assert priority["explanation"]
    assert any(f["points"] > 0 for f in priority["factors"])

    # timeline audit events exist for each intelligence stage
    audit = client.get("/api/audit", params={"entityId": issue_id}).json()
    actions = {a["action"] for a in audit}
    for expected in (
        "Citizen submitted report",
        "AI analysis completed",
        "Trust evaluated",
        "Duplicate cluster updated",
        "Priority calculated",
    ):
        assert expected in actions, f"missing audit event: {expected} (have {sorted(actions)})"

    # --- Officer sees the issue
    fetched = client.get(f"/api/issues/{issue_id}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == issue_id

    # 9: department assigned
    assign = client.post(f"/api/issues/{issue_id}/assign-department",
                         json={"departmentId": "dept-road", "actorId": "u-officer-road", "actorRole": "DEPARTMENT_OFFICER"})
    assert assign.status_code == 200, assign.text
    assert assign.json()["departmentId"] == "dept-road"

    # 10-11: crew assigned + work order created
    wo_res = client.post(f"/api/issues/{issue_id}/work-orders",
                         json={"crewId": "crew-road-a", "instructions": "", "actorId": "u-officer-road", "actorRole": "DEPARTMENT_OFFICER"})
    assert wo_res.status_code == 201, wo_res.text
    wo = wo_res.json()["workOrder"]
    wo_id = wo["id"]
    assert wo["crewId"] == "crew-road-a"
    assert wo["status"] == "ASSIGNED"
    assert wo["slaDueAt"]

    # role enforcement: citizen may not create work orders
    forbidden = client.post(
        f"/api/issues/{issue_id}/work-orders",
        json={"crewId": "crew-road-a", "instructions": "", "actorId": "u-citizen-1", "actorRole": "CITIZEN"},
    )
    assert forbidden.status_code == 403

    # --- Crew accepts, dispatches, uploads BEFORE
    for status in ("ACCEPTED", "DISPATCHED", "IN_PROGRESS"):
        r = client.post(f"/api/work-orders/{wo_id}/transition",
                        json={"status": status, "note": "crew step", "actorId": "u-crew-road-a", "actorRole": "FIELD_CREW"})
        assert r.status_code == 200, r.text

    before = client.post(f"/api/work-orders/{wo_id}/evidence", json={
        "kind": "BEFORE",
        "dataUrl": "data:image/svg+xml;charset=utf-8,%3Csvg%3Ebefore%3C/svg%3E",
        "actorId": "u-crew-road-a", "actorRole": "FIELD_CREW",
    })
    assert before.status_code == 200
    assert before.json()["beforeEvidenceId"]

    # 12: mark repaired
    repaired = client.post(f"/api/work-orders/{wo_id}/mark-repaired", json={
        "note": "Filled pothole with hot mix, compacted, cones placed.",
        "actorId": "u-crew-road-a", "actorRole": "FIELD_CREW",
    })
    assert repaired.status_code == 200
    assert repaired.json()["repairedAt"]

    # 13: after evidence + submit
    after = client.post(f"/api/work-orders/{wo_id}/evidence", json={
        "kind": "AFTER",
        "dataUrl": "data:image/svg+xml;charset=utf-8,%3Csvg%3Eafter%3C/svg%3E",
        "actorId": "u-crew-road-a", "actorRole": "FIELD_CREW",
    })
    assert after.status_code == 200
    assert after.json()["afterEvidenceId"]

    submitted = client.post(f"/api/work-orders/{wo_id}/submit-repair", json={
        "submission": {"repairedFlag": True, "note": "Repair complete"},
        "actorId": "u-crew-road-a", "actorRole": "FIELD_CREW",
    })
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "REPAIR_SUBMITTED"

    # 14: verification with before/after comparison
    ver = client.post(f"/api/work-orders/{wo_id}/verify", json={
        "decision": {"result": "RESOLVED", "notes": "Before/after comparison confirms defect corrected."},
        "actorId": "u-inspector-1", "actorRole": "INSPECTOR",
    })
    assert ver.status_code == 200, ver.text
    ver_body = ver.json()
    assert ver_body["verification"]["result"] == "RESOLVED"
    checks = ver_body["verification"]["checks"]
    assert len(checks) == 5
    assert all(c["pass"] for c in checks), [c for c in checks if not c["pass"]]

    # 15: resolved
    assert ver_body["workOrder"]["status"] == "RESOLVED"
    assert ver_body["issue"]["status"] == "RESOLVED"
    assert ver_body["issue"]["closedAt"]

    # 16: citizen sees updated status + notification
    citizen_view = client.get(f"/api/issues/{issue_id}").json()
    assert citizen_view["status"] == "RESOLVED"
    notifs = client.get("/api/notifications", params={"userId": "u-citizen-1", "role": "CITIZEN"}).json()
    titles = {n["title"] for n in notifs}
    assert "Your report has been received" in titles
    assert "Your issue has been resolved" in titles

    # 17: risk engine displays future risk (simulated)
    risk = client.get("/api/risk", params={"horizon": 30})
    assert risk.status_code == 200
    preds = risk.json()
    assert len(preds) > 0
    for p in preds:
        assert p["synthetic"] is True
        assert 0 <= p["currentRisk"] <= 100
        assert 0 <= p["predictedRisk"] <= 100
        assert p["recommendedAction"]
        assert p["factors"]

    # full audit trail of the workflow
    audit2 = client.get("/api/audit", params={"entityId": wo_id}).json()
    wo_actions = {a["action"] for a in audit2}
    for expected in ("Work order created", "Crew assigned", "BEFORE evidence uploaded", "AFTER evidence uploaded", "Status transition"):
        assert expected in wo_actions, f"missing WO audit: {expected}"


def test_duplicate_detection_unit(client: TestClient):
    r = client.post("/api/services/duplicates", json={
        "candidate": {
            "id": "DRAFT",
            "point": {"lat": 18.52063, "lng": 73.85671},
            "description": "pothole near bus stop",
            "category": "POTHOLE",
            "createdAt": "2026-10-01T10:00:00Z",
        }
    })
    assert r.status_code == 200
    body = r.json()
    assert body["matchedCount"] >= 7
    assert body["simulated"] is True


def test_classification_unit(client: TestClient):
    r = client.post("/api/services/classify", json={"description": "water leaking from the pipe"})
    assert r.status_code == 200
    body = r.json()
    assert body["category"] == "WATER_LEAK"
    assert body["departmentId"] == "dept-water"
    assert body["simulated"] is True


def test_input_validation(client: TestClient):
    # missing description → 422
    bad = client.post("/api/reports", json={"point": {"lat": 1, "lng": 1}, "address": "x"})
    assert bad.status_code == 422
    # non-image data URL → 422
    bad2 = client.post("/api/reports", json={
        "description": "pothole here", "point": {"lat": 18.52, "lng": 73.85},
        "address": "x", "imageDataUrl": "text/plain;base65,AAAA",
    })
    assert bad2.status_code == 422


def test_stats_endpoint(client: TestClient):
    r = client.get("/api/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["synthetic"] is True
    assert body["totalReports"] > 0
    assert body["activeIssues"] >= 0
