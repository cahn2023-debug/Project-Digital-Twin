---
id: 20260809-1917-document-sources-remain-read-only-and-produce-evidence-backed-relationship-proposals
title: Document sources remain read-only and produce evidence-backed relationship proposals
status: draft
supersedes: []
supersededBy: []
tags:
  - local-file-ingestion
  - documents
  - assets
  - relationships
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - tgowk5
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "tgowk5" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T12:17:26.183Z'
createdAt: '2026-08-09T12:17:26.183Z'
updatedAt: '2026-08-09T12:17:26.183Z'
---

## Context

Markdown-like text, TXT and Word can contain structured content, tables, local assets and references to canonical objects. Source originals must remain reproducible while ambiguous relations wait for user confirmation.

## Decision

Read Markdown/TXT/Word as immutable source assets using a common document model. Preserve source hash, file/version/location for nodes, tables, links and assets; route recognizable tables through the existing mapping contract; register image/attachment hashes as source assets; and place all inferred relations in a DOCUMENT_IMPORT ChangeSet as PENDING_CONFIRMATION proposals with evidence before any canonical apply.

## Alternatives Considered

Modify source documents during import; flatten documents into untraceable text; auto-attach ambiguous references without a review state.

## Consequences

Document imports are reproducible and auditable, asset and relation provenance survives parsing, and users can resolve ambiguous references before canonical mutation. The current Word support targets OOXML .docx; unsupported binary formats remain explicit errors.
