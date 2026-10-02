"""Auth API — demo role session (§32).

Phase 1: role assertion headers only. A real identity provider (Supabase
Auth boundary) plugs into `get_current_user` later without route changes.
"""

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.entities import ROLE_VALUES, Role

router = APIRouter(tags=["auth"])


@router.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {"userId": user.user_id, "role": user.role.value, "demo": True}


@router.get("/auth/roles")
def roles():
    return {"roles": ROLE_VALUES, "note": "Demo sign-in — role assertion only, no passwords in Phase 1."}
