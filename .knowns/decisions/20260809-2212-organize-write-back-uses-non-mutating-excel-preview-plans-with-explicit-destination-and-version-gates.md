---
id: 20260809-2212-organize-write-back-uses-non-mutating-excel-preview-plans-with-explicit-destination-and-version-gates
title: Organize write-back uses non-mutating Excel preview plans with explicit destination and version gates
status: draft
supersedes: []
supersededBy: []
tags:
  - organize
  - write-back
  - preview
  - excel
  - safety
sources:
  - '@doc/specs/2026-08-09/organize-data-classification-grouping-and-source-management'
relatedDocs:
  - specs/2026-08-09/organize-data-classification-grouping-and-source-management
relatedTasks:
  - ffh54s
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "ffh54s" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T15:12:22.942Z'
createdAt: '2026-08-09T15:12:22.942Z'
updatedAt: '2026-08-09T15:12:22.942Z'
---

## Context

Organize needs a safe boundary between canonical classification and source-file writes. The approved spec requires preview, explicit confirmation, immutable version/hash evidence, unmanaged-content preservation and a user-selected destination before any write.

## Decision

The Organize Excel preview endpoint creates and stores a PREVIEW plan only. Each file entry carries destination mode/path, current and expected revision/hash, metadata/content changes, source locators, unmanaged-content preservation and safety warnings. Confirmation is required and can_confirm is false for missing/stale version evidence, unavailable source paths, unsupported destinations or non-explicit new-file destinations. The preview path never creates or completes a write job.

## Alternatives Considered

- Reuse the existing file-write job endpoint directly from Organize: rejected because it would blur preview and confirmed execution.
- Allow inferred new-file destinations without a warning: rejected because source/root safety requires an explicit destination.
- Treat missing/stale hash or revision as informational: rejected because stale writes must be blocked.

## Consequences

- Later execution tasks can consume a stable plan and require explicit editor confirmation.
- Preview is useful even when blocked because it explains file-level risks and diffs.
- Actual workbook serialization, confirmation and restore remain separate capabilities.
