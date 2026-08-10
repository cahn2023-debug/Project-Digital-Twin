from typing import Any
from uuid import UUID

class RevisionConflict(Exception):
    def __init__(self, entity_id: UUID, base_revision: int, current_revision: int):
        self.entity_id = entity_id
        self.base_revision = base_revision
        self.current_revision = current_revision
        super().__init__(
            f"Revision conflict for {entity_id}: base={base_revision}, current={current_revision}"
        )


class FileImportConflict(Exception):
    def __init__(self, changeset_id: UUID, conflicts: list[dict[str, Any]]):
        self.changeset_id = changeset_id
        self.conflicts = conflicts
        super().__init__(f"File import conflict for {changeset_id}")


class FileWriteConflict(Exception):
    pass


class OrganizeValidationError(ValueError):
    pass


class OrganizeConflictError(ValueError):
    pass


class ProjectValidationError(ValueError):
    pass


class ProjectConflictError(ValueError):
    pass
