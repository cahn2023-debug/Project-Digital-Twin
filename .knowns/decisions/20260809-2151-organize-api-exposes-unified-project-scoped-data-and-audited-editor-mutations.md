---
id: 20260809-2151-organize-api-exposes-unified-project-scoped-data-and-audited-editor-mutations
title: Organize API exposes unified project-scoped data and audited editor mutations
status: draft
supersedes: []
supersededBy: []
tags:
  - organize
  - api
  - authorization
  - audit
  - provenance
sources:
  - '@doc/specs/2026-08-09/organize-data-classification-grouping-and-source-management'
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
  - '@doc/specs/2026-08-09/project-create-and-delete-lifecycle'
relatedDocs:
  - specs/2026-08-09/organize-data-classification-grouping-and-source-management
relatedTasks:
  - uo3utj
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "uo3utj" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T14:51:08.665Z'
createdAt: '2026-08-09T14:51:08.665Z'
updatedAt: '2026-08-09T14:51:08.665Z'
---

## Context

The Organize UI needs one project-scoped read contract that combines canonical entities, source files and import records with group/tag/lifecycle/source provenance. It also needs editor-only mutations that preserve the existing append-only audit and ChangeSet/provenance boundaries.

## Decision

Expose a unified Organize snapshot/filter API for canonical, source-file and import items, plus project-scoped group/tag/membership/lifecycle mutations. Permit only project editor roles to mutate; keep read access separate. Record each Organize mutation through the existing outbox/audit boundary with before/after values, actor, correlation/causation and project scope. Do not perform source-file writes or serializer work in this API boundary.

## Alternatives Considered

1. Expose separate object/file/import endpoints and let the UI merge them.
2. Allow UI fixture-only classification until write-back is implemented.
3. Provide one unified project-scoped snapshot and audited editor mutation boundary.

## Consequences

The frontend can render one stable Organize contract and later write-back tasks can consume the same group/tag/source links. API responses must preserve UUID/version/source-locator details and future persistence adapters must retain the audit and authorization semantics.
