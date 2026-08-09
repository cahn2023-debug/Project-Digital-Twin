---
id: 20260809-2116-organize-extends-source-write-back-boundary-with-explicit-preview-and-confirmation
title: Organize extends source write-back boundary with explicit preview and confirmation
status: draft
supersedes: []
supersededBy: []
tags:
  - organize
  - write-back
  - source-files
  - project-digital-twin
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
  - '@doc/specs/2026-08-09/project-create-and-delete-lifecycle'
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks: []
verification: []
reviewState: ready_for_review
reviewBlockers: []
reviewMatches: []
reviewAllowedResolutions:
  - accept_new
  - reject_new
reviewEvaluatedAt: '2026-08-09T14:16:33.443Z'
createdAt: '2026-08-09T14:16:33.443Z'
updatedAt: '2026-08-09T14:16:33.443Z'
---

## Context

The approved local-file-ingestion-and-synchronization spec keeps Markdown/TXT/Word originals read-only and models write-back permissions as independent capabilities. The Organize feature needs to synchronize classification/group changes to source content across Excel, Markdown, TXT and Word while preserving provenance, ChangeSet review, immutable versions, conflict evidence and auditability.

## Decision

For the Organize workflow only, allow a project editor to choose in-place or new-file write-back for Excel, Markdown, TXT and Word after a mandatory preview/diff and explicit confirmation. Use format-aware restructuring when the existing structure is detectable; otherwise require manual mapping. Preserve backup/version/restore, stale/locked/conflict blocking, Raw/source locators, ChangeSet boundaries, self-write suppression and append-only audit. This explicitly supersedes the source-format read-only and separate-write-back-permission boundaries of the approved ingestion spec for Organize, without changing unrelated ingestion flows.

## Alternatives Considered

1. Keep the existing Excel-only write-back and separate permission boundary.
2. Generate proposals for non-Excel files but leave actual writes to a separate workflow.
3. Allow Organize write-back across all supported formats with explicit preview and confirmation.

## Consequences

Organize becomes a cross-format mutation workflow and requires format-specific serializers/restructure logic, backup/version/restore support and stronger verification for Markdown, TXT and Word. Existing provenance, ChangeSet and audit contracts remain mandatory. The broader capability increases implementation and conflict-handling scope.
