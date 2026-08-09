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
