from uuid import uuid4

import pytest

from app.authorization import AuthorizationError, Principal, Role, authorize


def test_authorization_enforces_project_scope_and_action_role() -> None:
    project_id = uuid4()
    principal = Principal("designer-1", frozenset({Role.DESIGNER}), frozenset({project_id}))
    authorize(principal, "design.edit", project_id)

    with pytest.raises(AuthorizationError):
        authorize(principal, "approval.apply", project_id)
    with pytest.raises(AuthorizationError):
        authorize(principal, "design.edit", uuid4())


def test_audit_export_approval_and_restore_are_independent_permissions() -> None:
    project_id = uuid4()
    viewer = Principal("viewer-1", frozenset({Role.VIEWER}), frozenset({project_id}))
    engineer = Principal("engineer-1", frozenset({Role.PROJECT_ENGINEER}), frozenset({project_id}))
    approver = Principal("approver-1", frozenset({Role.APPROVER}), frozenset({project_id}))

    authorize(viewer, "audit.view", project_id)
    with pytest.raises(AuthorizationError):
        authorize(viewer, "audit.export", project_id)
    authorize(engineer, "audit.export", project_id)
    authorize(approver, "changeset.approve", project_id)
    with pytest.raises(AuthorizationError):
        authorize(approver, "file.restore", project_id)
