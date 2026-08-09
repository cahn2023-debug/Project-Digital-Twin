---
id: 20260809-2133-organize-uses-project-scoped-multi-parent-group-memberships-and-reversible-item-lifecycle
title: Organize uses project-scoped multi-parent group memberships and reversible item lifecycle
status: draft
supersedes: []
supersededBy: []
tags:
  - organize
  - groups
  - tags
  - lifecycle
  - domain
sources:
  - '@doc/specs/2026-08-09/organize-data-classification-grouping-and-source-management'
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
  - '@doc/docs/adr/ADR-001-canonical-entity-identity'
  - '@doc/docs/adr/ADR-002-file-authority'
relatedDocs:
  - specs/2026-08-09/organize-data-classification-grouping-and-source-management
relatedTasks:
  - 00yzz4
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'source "@doc/docs/adr/ADR-001-canonical-entity-identity" is not readable: doc "docs/adr/ADR-001-canonical-entity-identity" not found'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T14:33:15.675Z'
createdAt: '2026-08-09T14:33:15.675Z'
updatedAt: '2026-08-09T14:33:15.675Z'
---

## Context

Organize needs to classify canonical objects and source/import references across multiple nested groups while preserving project isolation and reversible lifecycle state. Existing canonical service and file ingestion contracts use immutable identities and project boundaries, but no shared Organize group/tag model exists.

## Decision

Represent Organize groups as project-scoped nodes in an acyclic directed graph with multiple parent links, tags as project-scoped labels, and memberships keyed by project plus item type/id. Deleting a group removes the group and its membership/parent links without deleting items or child groups. Object/source/import lifecycle uses ACTIVE, ARCHIVED and DELETED states with restore; hard deletion is outside the Organize workflow. Enforce the invariants in the domain boundary and database schema.

## Alternatives Considered

1. Use a strict single-parent tree, which cannot represent cross-cutting group membership.
2. Store groups/tags only in UI fixtures or unscoped metadata.
3. Use a project-scoped multi-parent DAG with reversible item lifecycle and schema/domain isolation.

## Consequences

Organize queries and mutations can share one typed classification contract across canonical and source data. Cycle validation and membership cleanup are required, and future API/persistence adapters must preserve project-scoped composite constraints. Hard deletion remains a separate administrative workflow.
