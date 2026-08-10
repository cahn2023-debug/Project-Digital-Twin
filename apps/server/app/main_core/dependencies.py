from __future__ import annotations

from contextvars import ContextVar
from typing import Any
from uuid import UUID

from ..authorization import AuthorizationError, Principal, Role, authorize
from ..domain import CameraStore
from ..platform.runtime import build_store


current_principal: ContextVar[Principal | None] = ContextVar("current_principal", default=None)
_store: CameraStore = build_store()


def get_store() -> CameraStore:
    return _store


def set_store(store: CameraStore) -> None:
    global _store
    _store = store


def authorize_header(project_id: UUID, action: str, actor: str, role: str) -> None:
    try:
        principal = current_principal.get()
        if principal is None:
            principal = Principal(actor, frozenset({Role(role)}), frozenset({project_id}))
        authorize(principal, action, project_id)
    except (AuthorizationError, ValueError) as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail=str(exc)) from exc


def organize_group_state(group: Any) -> dict[str, Any]:
    return {
        "id": str(group.id),
        "project_id": str(group.project_id),
        "name": group.name,
        "parent_ids": [str(parent_id) for parent_id in group.parent_ids],
        "status": group.status,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


def organize_membership_state(project_id: UUID, item_type: str, item_ids: list[UUID]) -> dict[str, list[str]]:
    store = get_store()
    return {
        "group_ids": [
            str(membership.group_id)
            for membership in store.list_organize_group_memberships(project_id, item_type, set(item_ids))
        ],
        "tag_ids": [
            str(membership.tag_id)
            for membership in store.list_organize_tag_memberships(project_id, item_type, set(item_ids))
        ],
    }
