---
id: 20260809-1846-schema-fields-and-mapping-transforms-are-explicit-and-reviewable
title: Schema fields and mapping transforms are explicit and reviewable
status: draft
supersedes: []
supersededBy: []
tags:
  - mapping
  - schema
  - identity
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - epi5h5
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "epi5h5" is "todo"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T11:46:17.086Z'
createdAt: '2026-08-09T11:46:17.086Z'
updatedAt: '2026-08-09T11:46:17.086Z'
---

## Context

Local files contain heterogeneous columns that must map into stable schema fields without losing Raw values or silently merging identities.

## Decision

Mapping uses explicit schema field IDs and typed FieldMapping entries. The preview may apply a constrained deterministic rule set, infer custom field types for user confirmation, preserve unmapped/invalid values in Raw, and emit identity candidates that always require confirmation before reusing an entity UUID.

## Alternatives Considered

Map by display names only; rejected because names change across files and cannot preserve stable schema identity. Auto-merge fuzzy identity matches; rejected because ambiguous objects need user confirmation.

## Consequences

Mapping output is suitable for ChangeSet construction and cross-file review. Arbitrary code execution is not part of Profile transformations; unsupported rules fail visibly.
