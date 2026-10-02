"""Demo authentication + role authorization (§32).

Header-based demo identity (`X-User-Id`, `X-Role`) standing in until a real
identity provider is plugged into the same `get_current_user` signature.
Server-side role checks are enforced on every mutating municipal route.
"""

from fastapi import Depends, Header, HTTPException, status

from app.core.config import settings
from app.models.entities import ROLE_VALUES, Role

CITIZEN_ROLES = {"CITIZEN"}
CREW_ROLES = {"FIELD_CREW"}
INSPECTOR_ROLES = {"INSPECTOR"}
OFFICER_ROLES = {"DEPARTMENT_OFFICER", "SUPERVISOR", "CITY_ADMIN", "CITY_LEADERSHIP", "INSPECTOR"}
ADMIN_ROLES = {"CITY_ADMIN", "SUPERVISOR"}


class CurrentUser:
    def __init__(self, user_id: str, role: Role) -> None:
        self.user_id = user_id
        self.role = role

    @property
    def is_admin(self) -> bool:
        return self.role in ADMIN_ROLES


def get_current_user(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_role: str | None = Header(default=None, alias="X-Role"),
) -> CurrentUser:
    role_raw = (x_role or settings.default_role).upper()
    if role_raw not in ROLE_VALUES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown role: {role_raw}")
    return CurrentUser(user_id=x_user_id or settings.default_user_id, role=Role(role_raw))  # type: ignore[arg-type]


def require_roles(*allowed: Role):
    allowed_set = set(allowed)

    def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role.value} may not perform this action",
            )
        return user

    return _dep


# Convenience presets used by the routers
require_staff = require_roles(*OFFICER_ROLES)
require_admin = require_roles(*ADMIN_ROLES)
require_crew = require_roles(*CREW_ROLES, *OFFICER_ROLES)
require_inspector = require_roles(*INSPECTOR_ROLES, Role.SUPERVISOR, Role.CITY_ADMIN)
require_any = require_roles(*[Role(v) for v in ROLE_VALUES])

# Body-declared actor tiers (§32) — mirror the header presets above.
STAFF_ROLES = frozenset(OFFICER_ROLES)
CREW_ACCESS_ROLES = frozenset(CREW_ROLES | OFFICER_ROLES)
INSPECTOR_ACCESS_ROLES = frozenset(INSPECTOR_ROLES | {"SUPERVISOR", "CITY_ADMIN"})


def ensure_actor_role(declared: Role, allowed) -> None:
    """Second authorization layer: the actor role declared in the request body.

    Header auth falls back to CITY_ADMIN when no identity provider is wired
    (demo mode), so every mutating municipal route must ALSO enforce the role
    the request itself claims — a CITIZEN actor can never dispatch crews or
    verify repairs, regardless of headers.
    """
    if declared not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role {declared.value} may not perform this action",
        )
