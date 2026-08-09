---
id: 20260809-1925-audit-is-append-only-project-scoped-and-independently-permissioned
title: Audit is append-only, Project-scoped and independently permissioned
status: draft
supersedes: []
supersededBy: []
tags:
  - local-file-ingestion
  - audit
  - permissions
  - retention
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - c6dq6m
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "c6dq6m" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T12:25:16.543Z'
createdAt: '2026-08-09T12:25:16.543Z'
updatedAt: '2026-08-09T12:25:16.543Z'
---

## Context

Local-first ingestion spans detection, parsing, mapping, preview, ChangeSet approval, conflict, sync and write-back. Users need reproducible field-level history without granting audit export, approval and restore the same authority.

## Decision

Every lifecycle outbox event also appends an immutable audit record with actor, operation, time, file/object/Profile/ChangeSet links, field before/after values, correlation and causation IDs, status and optional processing duration. Audit queries and exports are Project-scoped; audit view, audit export, ChangeSet approval and file restore are separate authorization actions. Local version cleanup is allowed only after an explicit server revision acknowledgment.

## Alternatives Considered

Use mutable logs; expose only a global audit feed; couple all audit/approval/restore permissions; clean local versions before server acknowledgment.

## Consequences

The audit trail can reconstruct and filter the full ingestion lifecycle, permission checks are independently testable, and local cleanup cannot remove evidence before synchronization. Derived UI data remains rebuildable while server-side history stays authoritative.
