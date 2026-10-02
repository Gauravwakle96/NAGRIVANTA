"""Deterministic seed data — mirrors the frontend demo dataset shape.

Runs once when the database is empty so the API is usable standalone (§24).
"""

import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.entities import (
    AuditLog,
    Category,
    Crew,
    CrewMember,
    Department,
    Evidence,
    Issue,
    IssueCategory,
    IssueStatus,
    Notification,
    Priority,
    PriorityScore,
    Report,
    RiskZone,
    Role,
    TrustScore,
    UserProfile,
    VerificationRecord,
    WorkOrder,
    WorkOrderEvent,
    WorkOrderStatus,
)

DEPARTMENTS = [
    dict(id="dept-road", name="Road Maintenance", short_name="ROADS", color="var(--chart-1)",
         categories=["POTHOLE", "ROAD_DAMAGE"], description="Carriageway, potholes, resurfacing and pavement defects."),
    dict(id="dept-water", name="Water Supply", short_name="WATER", color="var(--chart-5)",
         categories=["WATER_LEAK"], description="Potable water mains, leakage and standpipe repairs."),
    dict(id="dept-sanitation", name="Sanitation", short_name="SANI", color="var(--chart-2)",
         categories=["GARBAGE"], description="Waste collection, street cleaning and dumping removal."),
    dict(id="dept-electrical", name="Electrical", short_name="ELEC", color="var(--chart-3)",
         categories=["STREETLIGHT"], description="Street lighting, poles and public electrical fittings."),
    dict(id="dept-drainage", name="Drainage", short_name="DRN", color="var(--chart-4)",
         categories=["DRAINAGE"], description="Storm drains, culverts, de-silting and flood prevention."),
]

CATEGORIES = [
    dict(id="POTHOLE", label="Pothole", department_id="dept-road", keywords=["pothole", "hole", "crater", "road hole", "sunken", "dip"], sla_hours=72),
    dict(id="ROAD_DAMAGE", label="Road Damage", department_id="dept-road", keywords=["cracked", "crack", "broken road", "road edge", "rutting", "tar"], sla_hours=96),
    dict(id="WATER_LEAK", label="Water Leak", department_id="dept-water", keywords=["leak", "leaking", "water", "burst pipe", "flooding", "dripping"], sla_hours=24),
    dict(id="GARBAGE", label="Garbage / Waste", department_id="dept-sanitation", keywords=["garbage", "trash", "waste", "dump", "bin", "litter", "stink"], sla_hours=48),
    dict(id="STREETLIGHT", label="Streetlight", department_id="dept-electrical", keywords=["streetlight", "street light", "lamp", "dark", "flickering", "pole"], sla_hours=120),
    dict(id="DRAINAGE", label="Drainage", department_id="dept-drainage", keywords=["drain", "sewage", "clogged", "manhole", "overflow", "gutter"], sla_hours=48),
]

ZONES = [
    dict(id="z-mg", name="MG Road", lat=18.5204, lng=73.8567, traffic_class="ARTERIAL", ward=4),
    dict(id="z-stn", name="Station Road", lat=18.5294, lng=73.8567, traffic_class="ARTERIAL", ward=3),
    dict(id="z-civ", name="Civil Lines", lat=18.5294, lng=73.8657, traffic_class="COLLECTOR", ward=6),
    dict(id="z-mkt", name="Market Quarter", lat=18.5204, lng=73.8677, traffic_class="COLLECTOR", ward=7),
    dict(id="z-riv", name="Riverside Colony", lat=18.5114, lng=73.8647, traffic_class="LOCAL", ward=9),
    dict(id="z-old", name="Old Town", lat=18.5114, lng=73.8487, traffic_class="COLLECTOR", ward=2),
    dict(id="z-air", name="Airport Road", lat=18.5364, lng=73.8467, traffic_class="ARTERIAL", ward=11),
    dict(id="z-ind", name="Industrial Estate", lat=18.5024, lng=73.8557, traffic_class="LOCAL", ward=12),
    dict(id="z-lak", name="Lake View", lat=18.5024, lng=73.8717, traffic_class="LOCAL", ward=8),
    dict(id="z-grn", name="Green Park", lat=18.5364, lng=73.8717, traffic_class="COLLECTOR", ward=5),
]

CREWS = [
    dict(id="crew-road-a", name="Road Team A", department_id="dept-road", member_count=4, lead_name="Sanjay Pawar", status="AVAILABLE", base_lat=18.5196, base_lng=73.8549),
    dict(id="crew-road-b", name="Road Team B", department_id="dept-road", member_count=3, lead_name="Vikram Rao", status="AVAILABLE", base_lat=18.5334, base_lng=73.8493),
    dict(id="crew-water-1", name="Water Crew 1", department_id="dept-water", member_count=3, lead_name="Dev Patil", status="AVAILABLE", base_lat=18.5272, base_lng=73.8623),
    dict(id="crew-sani-1", name="Sanitation Crew 1", department_id="dept-sanitation", member_count=5, lead_name="Kiran Yadav", status="AVAILABLE", base_lat=18.5152, base_lng=73.8601),
    dict(id="crew-elec-1", name="Electrical Crew 1", department_id="dept-electrical", member_count=2, lead_name="Anil Verma", status="AVAILABLE", base_lat=18.5338, base_lng=73.8669),
    dict(id="crew-drain-1", name="Drainage Crew 1", department_id="dept-drainage", member_count=4, lead_name="Faisal Khan", status="AVAILABLE", base_lat=18.5068, base_lng=73.8527),
]

PROFILES = [
    dict(user_id="u-citizen-1", display_name="Aarav Mehta", role=Role.CITIZEN),
    dict(user_id="u-citizen-2", display_name="Priya Nair", role=Role.CITIZEN),
    dict(user_id="u-crew-road-a", display_name="Sanjay Pawar", role=Role.FIELD_CREW, crew_id="crew-road-a"),
    dict(user_id="u-inspector-1", display_name="Rohan Deshpande", role=Role.INSPECTOR),
    dict(user_id="u-officer-road", display_name="Meera Kulkarni", role=Role.DEPARTMENT_OFFICER, department_id="dept-road"),
    dict(user_id="u-supervisor-1", display_name="Nandini Iyer", role=Role.SUPERVISOR),
    dict(user_id="u-admin-1", display_name="Rahul Bhatt", role=Role.CITY_ADMIN),
    dict(user_id="u-leadership-1", display_name="Dr. Ananya Sen", role=Role.CITY_LEADERSHIP),
]

STATUS_PATTERN = [
    "CLOSED", "RESOLVED", "RESOLVED", "IN_PROGRESS", "ASSIGNED",
    "TRIAGED", "REPORTED", "UNDER_REVIEW", "AWAITING_VERIFICATION", "REINSPECTION_REQUIRED",
    "CLOSED", "IN_PROGRESS", "RESOLVED", "ASSIGNED", "REPORTED",
    "UNDER_REVIEW", "CLOSED", "AWAITING_VERIFICATION", "IN_PROGRESS", "RESOLVED",
]

CATEGORY_CYCLE = [
    "POTHOLE", "GARBAGE", "WATER_LEAK", "STREETLIGHT", "DRAINAGE", "ROAD_DAMAGE",
    "POTHOLE", "STREETLIGHT", "GARBAGE", "WATER_LEAK",
]

WO_FOR_ISSUE = {
    "ASSIGNED": WorkOrderStatus.ASSIGNED,
    "IN_PROGRESS": WorkOrderStatus.IN_PROGRESS,
    "AWAITING_VERIFICATION": WorkOrderStatus.VERIFICATION,
    "RESOLVED": WorkOrderStatus.RESOLVED,
    "REINSPECTION_REQUIRED": WorkOrderStatus.REINSPECTION_REQUIRED,
    "CLOSED": WorkOrderStatus.CLOSED,
}

STREETS = ["MG Road", "Station Road", "Ring Road", "Market Street", "Temple Lane", "Canal Bank Road", "Old Customs Road", "Mill Lines", "Lake Road", "Orchard Avenue"]
LANDMARKS = ["bus stop", "school gate", "market entrance", "hospital corner", "bridge approach", "metro pillar", "signal junction", "community hall"]

DESCRIPTIONS = {
    "POTHOLE": ["Deep pothole on {street} near the {landmark}, cars swerving to avoid it.", "Large pothole by the {landmark} on {street}, bikes losing balance."],
    "ROAD_DAMAGE": ["Cracked and rutted road surface near the {landmark} on {street}.", "Road edge has broken away near the {landmark} on {street}."],
    "WATER_LEAK": ["Water main leaking continuously near the {landmark} on {street}.", "Standpipe gushing water by the {landmark} on {street}, wastage all day."],
    "GARBAGE": ["Garbage dumped and overflowing near the {landmark} on {street}.", "Trash pile uncollected for days near the {landmark} on {street}."],
    "STREETLIGHT": ["Streetlight out near the {landmark} on {street}, very dark at night.", "Two lamps dead near the {landmark} on {street}, unsafe stretch."],
    "DRAINAGE": ["Drain clogged and overflowing near the {landmark} on {street}.", "Sewage blockage near the {landmark} on {street}, water stagnating."],
}

INSTRUCTIONS = {
    "POTHOLE": "Clear debris, fill with hot-mix asphalt in layers, compact and level with surrounding surface. Cones while curing.",
    "ROAD_DAMAGE": "Mill damaged section, patch with base course and wearing course, compact to level. Reinforce edges.",
    "WATER_LEAK": "Isolate supply, excavate carefully, replace damaged pipe section, pressure-test before backfill.",
    "GARBAGE": "Load and clear all dumped waste, disinfect the spot, check bin collection schedule for the ward.",
    "STREETLIGHT": "Isolate circuit, inspect driver and lamp, replace faulty unit, verify lux level after dusk.",
    "DRAINAGE": "De-silt the drain, remove debris blockage, flush with water, inspect outlet flow.",
}


def _svg_image(category: str, kind: str) -> str:
    tints = {
        "POTHOLE": ("#475569", "#1e293b"),
        "ROAD_DAMAGE": ("#57534e", "#292524"),
        "WATER_LEAK": ("#0369a1", "#0c4a6e"),
        "GARBAGE": ("#4d7c0f", "#1a2e05"),
        "STREETLIGHT": ("#a16207", "#422006"),
        "DRAINAGE": ("#6d28d9", "#2e1065"),
    }
    c1, c2 = tints.get(category, ("#475569", "#1e293b"))
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0%" stop-color="{c1}"/><stop offset="100%" stop-color="{c2}"/></linearGradient></defs>'
        f'<rect width="640" height="420" fill="url(#g)"/>'
        f'<rect x="0" y="300" width="640" height="120" fill="rgba(0,0,0,0.25)"/>'
        f'<text x="32" y="70" font-family="monospace" font-size="30" fill="white" font-weight="700">{kind}</text>'
        f'<text x="32" y="108" font-family="monospace" font-size="19" fill="rgba(255,255,255,0.75)">{category.replace("_", " ")}</text>'
        f'<rect x="32" y="130" width="176" height="34" rx="17" fill="rgba(255,255,255,0.16)"/>'
        f'<text x="48" y="153" font-family="monospace" font-size="16" fill="#fff">SYNTHETIC</text>'
        f'<text x="32" y="396" font-family="monospace" font-size="15" fill="rgba(255,255,255,0.6)">DEMO EVIDENCE · GENERATED</text>'
        f"</svg>"
    )
    return f"data:image/svg+xml;charset=utf-8,{__import__('urllib.parse', fromlist=['quote']).quote(svg)}"


def _priority(report_count: int, severity: str, category: str, traffic: str, days_open: float) -> tuple[int, Priority, list[dict], str]:
    from app.services.priority import DemoPriorityEngine

    result = DemoPriorityEngine().calculate(
        report_count=report_count,
        severity=severity,
        category=IssueCategory(category),
        traffic_class=traffic,
        days_open=days_open,
        prior_work_orders=0,
    )
    factors = [{"label": f.label, "detail": f.detail, "weight": f.weight, "points": f.points} for f in result.factors]
    return result.score, result.level, factors, result.explanation


def is_seeded(db: Session) -> bool:
    return db.query(Department).count() > 0


def seed_if_empty(db: Session) -> None:
    if is_seeded(db):
        return

    now = datetime.now(timezone.utc)
    rng = random.Random(20261002)

    for d in DEPARTMENTS:
        db.add(Department(**d))
    db.flush()  # departments must exist before categories/crews reference them
    for c in CATEGORIES:
        db.add(Category(**c))
    for c in CREWS:
        db.add(Crew(**c))
    for p in PROFILES:
        db.add(UserProfile(**p))
    for i, z in enumerate(ZONES):
        db.add(RiskZone(id=z["id"], name=z["name"], lat=z["lat"], lng=z["lng"], radius_m=420))
        db.add(CrewMember(crew_id=CREWS[i % len(CREWS)]["id"], user_id=f"member-{i}", display_name=f"Worker {i + 1}"))
    db.flush()

    audit_seq = 1
    ev_seq = 1
    notif_seq = 1

    def audit(entity_type, entity_id, action, detail, actor_id, actor_role, at: datetime):
        nonlocal audit_seq
        db.add(AuditLog(
            id=f"AUD-{audit_seq:05d}", entity_type=entity_type, entity_id=entity_id, action=action,
            detail=detail, actor_id=actor_id, actor_role=actor_role, created_at=at,
        ))
        audit_seq += 1

    def notify(user_id, role, title, body, issue_id, at: datetime):
        nonlocal notif_seq
        db.add(Notification(
            id=f"NTF-{notif_seq:05d}", user_id=user_id, role=role, title=title, body=body,
            issue_id=issue_id, created_at=at,
        ))
        notif_seq += 1

    severity_for = {
        "POTHOLE": "HIGH", "WATER_LEAK": "HIGH", "DRAINAGE": "HIGH",
        "ROAD_DAMAGE": "MEDIUM", "GARBAGE": "MEDIUM", "STREETLIGHT": "LOW",
    }
    dept_for = {c["id"]: c["department_id"] for c in CATEGORIES}

    for i, status_raw in enumerate(STATUS_PATTERN):
        status = IssueStatus(status_raw)
        category = CATEGORY_CYCLE[i % len(CATEGORY_CYCLE)]
        zone = ZONES[i % len(ZONES)]
        street = STREETS[i % len(STREETS)]
        landmark = LANDMARKS[i % len(LANDMARKS)]
        description = rng.choice(DESCRIPTIONS[category]).format(street=street, landmark=landmark)

        lat = zone["lat"] + rng.uniform(-0.007, 0.007)
        lng = zone["lng"] + rng.uniform(-0.007, 0.007)
        days_old = 2 + rng.randint(0, 44)
        opened = now - timedelta(days=days_old, hours=rng.randint(0, 12))
        closed_at = None
        if status in (IssueStatus.CLOSED, IssueStatus.RESOLVED):
            closed_at = opened + timedelta(days=max(1, int(days_old * 0.7)))

        issue_id = f"NGV-{1001 + i}"
        report_count = 1 + rng.randint(0, 3)
        report_ids: list[str] = []
        photos = 0
        first_at = opened

        for r in range(report_count):
            at = opened + timedelta(hours=6 * (r + 1))
            has_photo = rng.random() > 0.35
            evidence_id = None
            if has_photo:
                evidence_id = f"EV-{ev_seq:05d}"
                db.add(Evidence(
                    id=evidence_id, kind="REPORT", url=_svg_image(category, "REPORT"),
                    caption="report evidence — synthetic placeholder", uploaded_at=at,
                    uploaded_by=rng.choice(["u-citizen-1", "u-citizen-2"]),
                    lat=lat, lng=lng,
                ))
                ev_seq += 1
                photos += 1
            rep_id = f"RPT-{len(report_ids) + i * 4:04d}"
            db.add(Report(
                id=rep_id, issue_id=issue_id, category=IssueCategory(category),
                description=description if r == 0 else rng.choice(DESCRIPTIONS[category]).format(street=street, landmark=landmark),
                lat=lat + rng.uniform(-0.0008, 0.0008), lng=lng + rng.uniform(-0.0008, 0.0008),
                address=f"{street}, Ward {zone['ward']} · {zone['name']}",
                evidence_id=evidence_id, submitted_by=rng.choice(["u-citizen-1", "u-citizen-2"]),
                created_at=at, synthetic=True,
            ))
            report_ids.append(rep_id)
            if at < first_at:
                first_at = at

        days_open = ((closed_at or now) - opened).total_seconds() / 86400
        score, level, factors, explanation = _priority(report_count, severity_for[category], category, zone["traffic_class"], days_open)

        has_dept = status not in (IssueStatus.REPORTED, IssueStatus.UNDER_REVIEW)
        has_crew = status in (
            IssueStatus.ASSIGNED, IssueStatus.IN_PROGRESS, IssueStatus.AWAITING_VERIFICATION,
            IssueStatus.RESOLVED, IssueStatus.REINSPECTION_REQUIRED, IssueStatus.CLOSED,
        )
        crew_id = None
        if has_crew:
            candidates = [c["id"] for c in CREWS if c["department_id"] == dept_for[category]]
            crew_id = candidates[0] if candidates else None

        issue = Issue(
            id=issue_id,
            title=f"{next(c['label'] for c in CATEGORIES if c['id'] == category)} — {zone['name']}",
            category=IssueCategory(category),
            department_id=dept_for[category] if has_dept else None,
            crew_id=crew_id,
            priority=level,
            status=status,
            lat=lat, lng=lng,
            address=f"{street}, Ward {zone['ward']} · {zone['name']}",
            report_ids=report_ids,
            unique_photo_count=photos,
            work_order_id=None,
            opened_at=opened,
            updated_at=closed_at or (now - timedelta(days=rng.randint(0, 3))),
            closed_at=closed_at,
            synthetic=True,
        )
        db.add(issue)
        db.flush()  # reports + issue must exist before FK references below

        db.add(TrustScore(
            report_id=report_ids[0], issue_id=issue_id,
            score=min(100, 34 + 24 + (18 if description else 0) + (10 if report_count > 1 else 0)),
            label="LIKELY_GENUINE" if report_count > 1 else "NEEDS_REVIEW",
            factors=[
                {"label": "Photo evidence attached", "detail": "Image present (+34).", "impact": "POSITIVE"},
                {"label": "Location provided", "detail": "Pin present (+24).", "impact": "POSITIVE"},
                {"label": "Corroborated by nearby reports", "detail": f"{max(0, report_count - 1)} independent report(s) nearby (+12).", "impact": "POSITIVE"},
            ],
            engine="DemoTrustEngine v1", evaluated_at=opened + timedelta(minutes=2),
        ))
        db.add(PriorityScore(
            issue_id=issue_id, score=score, level=level, factors=factors,
            explanation=explanation, calculated_at=opened + timedelta(minutes=3),
        ))

        audit("ISSUE", issue_id, "Citizen submitted report", f"Report {report_ids[0]} received at {zone['name']}.", report_ids[0], "CITIZEN", first_at)
        audit("ISSUE", issue_id, "AI analysis completed", f"Classified as {category} (demo confidence).", "system", "SYSTEM", first_at + timedelta(minutes=1))
        audit("ISSUE", issue_id, "Trust evaluated", "Trust score computed — demo engine.", "system", "SYSTEM", first_at + timedelta(minutes=2))
        if report_count > 1:
            audit("ISSUE", issue_id, "Duplicate cluster updated", f"{report_count} reports clustered into one master issue.", "system", "SYSTEM", first_at + timedelta(minutes=3))
        audit("ISSUE", issue_id, "Priority calculated", f"{level.value} ({score}/100): {explanation}", "system", "SYSTEM", first_at + timedelta(minutes=4))
        if issue.department_id:
            audit("ISSUE", issue_id, "Department assigned", f"Routed to {issue.department_id}.", "u-officer-road", "DEPARTMENT_OFFICER", first_at + timedelta(days=1))

        notify(report_ids[0] and "u-citizen-1", "CITIZEN", "Your report has been received", f"{issue_id} — {category} near {zone['name']}.", issue_id, first_at)

        wo_status = WO_FOR_ISSUE.get(status)
        if wo_status and crew_id:
            wo_id = f"WO-{i + 1:04d}"
            created = opened + timedelta(hours=12)
            before_id = f"EV-{ev_seq:05d}"
            db.add(Evidence(id=before_id, kind="BEFORE", url=_svg_image(category, "BEFORE"),
                            caption="before evidence — synthetic", uploaded_at=created + timedelta(hours=4),
                            uploaded_by=crew_id, lat=lat, lng=lng))
            ev_seq += 1
            after_id = None
            if wo_status in (WorkOrderStatus.VERIFICATION, WorkOrderStatus.RESOLVED, WorkOrderStatus.CLOSED, WorkOrderStatus.REINSPECTION_REQUIRED):
                after_id = f"EV-{ev_seq:05d}"
                db.add(Evidence(id=after_id, kind="AFTER", url=_svg_image(category, "AFTER"),
                                caption="after evidence — synthetic", uploaded_at=created + timedelta(days=1),
                                uploaded_by=crew_id, lat=lat, lng=lng))
                ev_seq += 1

            sla = next(c["sla_hours"] for c in CATEGORIES if c["id"] == category)
            wo = WorkOrder(
                id=wo_id, issue_id=issue_id, category=IssueCategory(category), priority=level,
                department_id=dept_for[category], crew_id=crew_id, lat=lat, lng=lng,
                address=issue.address, description=description,
                instructions=INSTRUCTIONS[category], status=wo_status,
                sla_due_at=opened + timedelta(hours=sla), created_at=created,
                updated_at=created + timedelta(days=1), before_evidence_id=before_id,
                after_evidence_id=after_id,
                repair_note="Repair completed per standard procedure." if after_id else None,
                repaired_at=created + timedelta(hours=20) if after_id else None,
            )
            db.add(wo)
            db.flush()  # work order must exist before events/verification reference it
            issue.work_order_id = wo_id
            db.add(WorkOrderEvent(work_order_id=wo_id, from_status=None, to_status=WorkOrderStatus.NEW.value,
                                  actor_id="u-officer-road", note="created", created_at=created))
            db.add(WorkOrderEvent(work_order_id=wo_id, from_status=WorkOrderStatus.NEW.value, to_status=wo_status.value,
                                  actor_id="u-officer-road", note="assigned to crew", created_at=created + timedelta(minutes=5)))
            audit("WORK_ORDER", wo_id, "Work order created", f"{wo_id} created for {issue_id}.", "u-officer-road", "DEPARTMENT_OFFICER", created)
            audit("WORK_ORDER", wo_id, "Crew assigned", f"Crew {crew_id} dispatched.", "u-officer-road", "DEPARTMENT_OFFICER", created + timedelta(minutes=5))
            audit("WORK_ORDER", wo_id, "BEFORE evidence uploaded", "Crew uploaded BEFORE photo.", crew_id, "FIELD_CREW", created + timedelta(hours=4))
            if after_id:
                audit("WORK_ORDER", wo_id, "AFTER evidence uploaded", "Crew uploaded AFTER photo.", crew_id, "FIELD_CREW", created + timedelta(days=1))
                result = "REINSPECTION_REQUIRED" if wo_status == WorkOrderStatus.REINSPECTION_REQUIRED else "RESOLVED"
                ver_id = f"VER-{i + 1:04d}"
                db.add(VerificationRecord(
                    id=ver_id, work_order_id=wo_id, issue_id=issue_id, result=result,
                    checks=[
                        {"key": "location", "label": "Location match", "pass": True, "detail": "Coordinates align."},
                        {"key": "timestamp", "label": "Evidence timestamps", "pass": True, "detail": "Both uploads timestamped."},
                        {"key": "evidence", "label": "Evidence completeness", "pass": True, "detail": "before + after uploaded."},
                        {"key": "visual", "label": "Reported repair complete", "pass": result == "RESOLVED", "detail": "Crew confirmed completion."},
                        {"key": "persistence", "label": "Issue persistence check", "pass": result == "RESOLVED", "detail": "No reopen reported."},
                    ],
                    notes="Evidence accepted." if result == "RESOLVED" else "Defect visible in after photo — reinspection scheduled.",
                    inspector_id="u-inspector-1", created_at=created + timedelta(days=1, hours=2),
                ))
                audit("VERIFICATION", ver_id, "Verification completed", f"Result: {result.replace('_', ' ')}.", "u-inspector-1", "INSPECTOR", created + timedelta(days=1, hours=2))
            if closed_at:
                audit("ISSUE", issue_id, "Issue closed", "Workflow complete.", "u-inspector-1", "INSPECTOR", closed_at)

    # --- MG Road pending duplicate cluster: 7 unclustered pothole reports ---
    mg = ZONES[0]
    for k in range(7):
        angle = (k / 7) * 2 * math.pi
        radius = 0.0006 + (k % 3) * 0.0005
        lat = mg["lat"] + math.sin(angle) * radius
        lng = mg["lng"] + math.cos(angle) * radius
        at = now - timedelta(hours=10 + k * 10)
        evidence_id = None
        if k < 4:
            evidence_id = f"EV-{ev_seq:05d}"
            db.add(Evidence(id=evidence_id, kind="REPORT", url=_svg_image("POTHOLE", "REPORT"),
                            caption="report evidence — synthetic", uploaded_at=at,
                            uploaded_by="u-citizen-1", lat=lat, lng=lng))
            ev_seq += 1
        db.add(Report(
            id=f"RPT-9{k + 1:03d}", issue_id=None, category=IssueCategory.POTHOLE,
            description=rng.choice(DESCRIPTIONS["POTHOLE"]).format(street="MG Road", landmark=rng.choice(LANDMARKS)),
            lat=lat, lng=lng, address="MG Road, Ward 4 · MG Road",
            evidence_id=evidence_id, submitted_by="u-citizen-1", created_at=at, synthetic=True,
        ))

    db.commit()
