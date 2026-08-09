---
id: 20260809-2216-organize-document-previews-use-format-adapters-and-require-mapping-for-uncertain-structure
title: Organize document previews use format adapters and require mapping for uncertain structure
status: draft
supersedes: []
supersededBy: []
tags:
  - organize
  - write-back
  - markdown
  - txt
  - word
  - mapping
sources:
  - '@doc/specs/2026-08-09/organize-data-classification-grouping-and-source-management'
relatedDocs:
  - specs/2026-08-09/organize-data-classification-grouping-and-source-management
relatedTasks:
  - mtb31t
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "mtb31t" is "todo"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T15:16:18.465Z'
createdAt: '2026-08-09T15:16:18.465Z'
updatedAt: '2026-08-09T15:16:18.465Z'
---

## Context

Markdown, TXT and Word sources have different structural signals and may contain unmanaged content that Organize must preserve. The approved spec requires format-aware planning, source locators, preview diffs and manual mapping when structure cannot be detected safely.

## Decision

The Organize preview boundary selects a format adapter for Markdown, TXT or Word, reports adapter/serializer, observed structure, source summary and preserved unmanaged content. A detected heading/table/metadata/list structure may proceed to preview; ambiguous or unreadable source structure adds MANUAL_MAPPING_REQUIRED and blocks confirmation until a per-file manual mapping is supplied. The adapter path remains read-only and does not create a write job.

## Alternatives Considered

- Treat every document as a flat replaceable blob: rejected because unmanaged content and locators would be lost.
- Infer TXT/Word record boundaries silently: rejected because uncertain structure must be mapped explicitly.
- Reuse the Excel adapter for all formats: rejected because format semantics and serializer behavior differ.

## Consequences

- Each format can evolve its serializer without changing Organize selection, version/hash or confirmation safety.
- Preview can explain uncertainty before any confirmation.
- Mapping payloads remain per-file and auditable for later execution tasks.
