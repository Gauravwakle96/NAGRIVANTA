"""Routing service — category → department assignment (§5)."""

from app.models.entities import IssueCategory

ROUTING: dict[IssueCategory, str] = {
    IssueCategory.POTHOLE: "dept-road",
    IssueCategory.ROAD_DAMAGE: "dept-road",
    IssueCategory.WATER_LEAK: "dept-water",
    IssueCategory.GARBAGE: "dept-sanitation",
    IssueCategory.STREETLIGHT: "dept-electrical",
    IssueCategory.DRAINAGE: "dept-drainage",
}

INSTRUCTIONS: dict[IssueCategory, str] = {
    IssueCategory.POTHOLE: "Clear debris, fill with hot-mix asphalt in layers, compact and level with surrounding surface. Cones while curing.",
    IssueCategory.ROAD_DAMAGE: "Mill damaged section, patch with base course and wearing course, compact to level. Reinforce edges.",
    IssueCategory.WATER_LEAK: "Isolate supply, excavate carefully, replace damaged pipe section, pressure-test before backfill.",
    IssueCategory.GARBAGE: "Load and clear all dumped waste, disinfect the spot, check bin collection schedule for the ward.",
    IssueCategory.STREETLIGHT: "Isolate circuit, inspect driver and lamp, replace faulty unit, verify lux level after dusk.",
    IssueCategory.DRAINAGE: "De-silt the drain, remove debris blockage, flush with water, inspect outlet flow.",
}


def route_to_department(category: IssueCategory) -> str:
    return ROUTING.get(category, "dept-road")


def instructions_for(category: IssueCategory) -> str:
    return INSTRUCTIONS.get(category, "Inspect and repair as per standard municipal procedure.")
