# ADR-002: Managed File Authority

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

The Camera workbook is an operational source and may move between client machines. A physical path is not a file identity, and unsafe write-back could destroy evidence or unrelated workbook content.

## Decision

The platform separates logical file identity, physical locations, and immutable file versions.

The logical file record contains `file_id`, `project_id`, `logical_role`, `authority_mode`, `parser_profile`, and `writer_profile`. A location contains `file_id`, `client_id`, `absolute_path`, and `last_seen_at`. A version contains `file_version_id`, `file_id`, monotonically increasing `revision`, `sha256`, `size`, `modified_at`, `created_at`, and lifecycle status.

Supported authority modes are `SOURCE_ONLY`, `MANAGED_FILE_MASTER`, `DATABASE_MASTER_EXPORT`, and `EXTERNAL_MASTER`. The Camera workbook may use `MANAGED_FILE_MASTER` only after its profile and contract pass validation. The canonical server remains authoritative for approved entity state; file authority controls the managed source/write-back relationship and never permits a server to write an arbitrary client path.

File versions are immutable. A location may change without changing `file_id`. Every parse and write job records the file version used. Safe writes verify the expected hash, detect locks, write to a temporary sibling, validate, atomically replace, rehash, create a backup/version, and register the result. A hash mismatch produces `FILE_CONFLICT`.

## Alternatives

- Treat absolute paths as identity: rejected because users move files.
- Let the server write client files: rejected because it violates desktop filesystem boundaries.
- Overwrite files in place without a version: rejected because it is irreversible.

## Consequences

Desktop owns filesystem access and file jobs. Server commands reference `file_id` and expected revision, not paths. Parsers and writers are profile-specific; generic workbook mutation is outside MVP scope.

Future object storage and additional file roles are non-binding extensions.

## Migration impact

Adoption registers existing files by role, calculates an initial version, and stores discovered locations. Rollback disables managed write-back and retains the registered versions. A later authority change requires a superseding ADR and a documented reconciliation period.

## Related ADRs and implementation order

Implement after [ADR-001](ADR-001-canonical-entity-identity.md) and before import or write-back. [ADR-003](ADR-003-changeset-model.md) governs file-triggered state changes; [ADR-008](ADR-008-storage-retention.md) governs version retention.

## Acceptance checks

- Move a workbook and verify the same `file_id` is retained with a new location.
- Modify the workbook outside the platform and verify the expected hash fails safely.
- Verify a write creates a backup/version and never changes unsupported sheets or columns.
- Verify a locked workbook yields a retryable failure without partial replacement.
- Verify every import and write job records its source or target file revision.

## Scenarios

### Normal flow

A desktop registers `CAMERA_MASTER`, hashes revision 1, imports it, receives a write job for revision 1, safely writes a validated temporary copy, replaces the workbook, and registers revision 2.

### Failure flow

A user edits the workbook between job creation and execution. The current hash differs from the expected revision, so the job becomes `FILE_CONFLICT` and no replacement occurs.

## Traceability

This ADR implements the managed-file, reversible-file, and provenance requirements in Project Platform Architecture v1.1 and F2 in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). The acceptance checks are the file-system contract for later implementation.

## Open questions (non-binding)

- Which Excel library best passes the required round-trip fixture suite.
- Whether server-side attachments require S3-compatible storage in the first pilot.
- The exact retention duration for working file versions.

