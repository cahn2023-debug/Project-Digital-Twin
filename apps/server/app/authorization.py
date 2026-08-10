from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class Role(StrEnum):
    PROJECT_ADMIN = "ProjectAdmin"
    PROJECT_ENGINEER = "ProjectEngineer"
    DESIGNER = "Designer"
    APPROVER = "Approver"
    CONTRACTOR_USER = "ContractorUser"
    VIEWER = "Viewer"


@dataclass(frozen=True)
class Principal:
    subject: str
    roles: frozenset[Role]
    project_ids: frozenset[UUID]


class AuthorizationError(PermissionError):
    pass


def authorize(principal: Principal, action: str, project_id: UUID) -> None:
    if project_id not in principal.project_ids:
        raise AuthorizationError("Principal is not scoped to this project")
    allowed_roles = {
        "read": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.DESIGNER, Role.APPROVER, Role.CONTRACTOR_USER, Role.VIEWER},
        "design.edit": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.DESIGNER},
        "organize.edit": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.DESIGNER},
        "field.submit": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.CONTRACTOR_USER},
        "approval.apply": {Role.PROJECT_ADMIN, Role.APPROVER},
        "audit.view": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.DESIGNER, Role.APPROVER, Role.CONTRACTOR_USER, Role.VIEWER},
        "audit.export": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER},
        "changeset.approve": {Role.PROJECT_ADMIN, Role.APPROVER},
        "changeset.edit": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.DESIGNER, Role.APPROVER},
        "changeset.reject": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.DESIGNER, Role.APPROVER},
        "changeset.sync": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER, Role.DESIGNER, Role.APPROVER},
        "file.restore": {Role.PROJECT_ADMIN, Role.PROJECT_ENGINEER},
    }
    if not principal.roles.intersection(allowed_roles.get(action, set())):
        raise AuthorizationError(f"Role is not authorized for {action}")
