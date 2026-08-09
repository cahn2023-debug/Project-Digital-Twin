---
title: Phase 0B architecture decision records
description: Specification for creating the eight accepted baseline architecture decision records for Project Digital Twin.
createdAt: '2026-08-09T08:59:04.866Z'
updatedAt: '2026-08-09T08:59:04.866Z'
tags:
  - spec
  - draft
  - architecture
  - adr
---

## Overview

This specification defines the deliverable for Phase 0B of Project Digital Twin: eight accepted baseline Architecture Decision Records (ADRs) that establish the technology-neutral contracts required by Project Platform Architecture v1.1.

The ADRs serve both implementers and architecture reviewers. They are binding for the MVP and Camera Vertical Slice only. Future-domain extensions may be documented as non-binding guidance.

The source baseline is the supplied Project Platform Architecture v1.1 prompt and the completed repository audit at docs/architecture/CURRENT_ARCHITECTURE.md. The repository currently contains no application implementation, so the ADRs must establish contracts without claiming existing code behavior.

## Locked Decisions

- D1: Deliver eight ADR documents themselves. Every ADR contains Context, Decision, Alternatives, Consequences, and Migration impact.
- D2: Lock platform contracts and invariants only. Libraries, databases, and infrastructure remain replaceable.
- D3: Create the ADRs as accepted baseline decisions immediately after creation. If corresponding Knowns System Decision records are created, their separate review-gated ledger rules still apply.
- D4: Define technology-neutral logical fields, state transitions, and MVP invariants in each ADR.
- D5: Make the ADRs binding for the MVP and Camera Vertical Slice; future-domain extensions are explicitly non-binding.
- D6: Include explicit cross-references to dependent ADRs and a dependency/order note in every ADR.
- D7: Include concrete acceptance checks for implementation conformance in every ADR.
- D8: Represent later conflicting architecture changes with a new superseding ADR and an explicit migration path while preserving the historical ADR.

## System Decision Impact

- Impact: none
- Decision: This spec defines accepted ADR document artifacts; it does not itself modify runtime architecture or the Knowns System Decision ledger.
- Acceptance gate: The eight ADR files must pass the acceptance criteria and document any separate System Decision ledger treatment without bypassing its review rules.

## Requirements

### Functional Requirements

- FR-1: Create exactly these eight files under docs/adr/:
  - ADR-001-canonical-entity-identity.md
  - ADR-002-file-authority.md
  - ADR-003-changeset-model.md
  - ADR-004-entity-revisions.md
  - ADR-005-sync-concurrency.md
  - ADR-006-event-outbox.md
  - ADR-007-geometry-conflicts.md
  - ADR-008-storage-retention.md
- FR-2: Each ADR must start with visible metadata identifying its ADR number, title, date, and Status: Accepted baseline.
- FR-3: Each ADR must contain these exact core sections: Context, Decision, Alternatives, Consequences, and Migration impact.
- FR-4: Each ADR must define technology-neutral logical fields, state transitions, and invariants relevant to its decision and the MVP.
- FR-5: Each ADR must avoid locking libraries, database products, infrastructure, frameworks, or vendors. Such choices may appear only as non-binding examples or open questions.
- FR-6: Each ADR must state which MVP and Camera Vertical Slice behaviors it governs. Future-domain extensions must be labeled non-binding.
- FR-7: Each ADR must include Related ADRs with explicit dependency references and an implementation-order note. The dependency order must preserve identity and authority foundations before mutation, revision, synchronization, event, geometry-conflict, and retention concerns.
- FR-8: Each ADR must include Acceptance checks that allow an implementer or reviewer to verify contract conformance.
- FR-9: Each ADR must include Scenarios with at least one normal flow and one relevant failure or edge case involving conflict, rollback, invalid state, or unavailable evidence.
- FR-10: Each ADR must include Traceability linking to Project Platform Architecture v1.1, docs/architecture/CURRENT_ARCHITECTURE.md, related ADRs, and its acceptance checks.
- FR-11: Each ADR's Migration impact must cover forward adoption and rollback or supersession handling.
- FR-12: Each ADR must list unresolved technology choices and other implementation details explicitly under non-binding Open questions; unresolved details must not become hidden contract rules.
- FR-13: A later conflict with an accepted ADR must be handled by creating a new superseding ADR, linking the predecessor, retaining the predecessor for history, and documenting the migration path.

### ADR-specific requirements

- FR-14 / ADR-001: Define immutable project-scoped entity identity, stable UUID usage, canonical code boundaries, and separation of identity from mutable state.
- FR-15 / ADR-002: Define managed-file identity independently of physical path, file versions and locations, authority modes, hash/version evidence, and reversible file operations.
- FR-16 / ADR-003: Define explicit ChangeSet and Change Item concepts, origins, statuses, base revisions, validation/conflict/approval gates, and the distinction between ChangeSets and domain events.
- FR-17 / ADR-004: Define versioned entity representations, revision numbering/current-revision lookup, DESIGNED and AS_BUILT MVP representations, and non-overwrite rules.
- FR-18 / ADR-005: Define server-authoritative revision contracts, client base revisions/cursors, deterministic delta submission, optimistic concurrency, rebase, and explicit conflict outcomes.
- FR-19 / ADR-006: Define the atomic canonical-mutation plus outbox boundary, event identity/ordering/retry semantics at the contract level, and rebuildable derived consumers without selecting a broker.
- FR-20 / ADR-007: Define technology-neutral geometry revision and conflict rules, including the MVP rule that concurrent edits to the same geometry produce an explicit conflict.
- FR-21 / ADR-008: Define retention, immutability, auditability, rebuildability, and deletion/archival constraints for raw evidence, revisions, ChangeSets, events, and derived data without selecting storage technology.

### Non-Functional Requirements

- NFR-1: The documents must use normative, testable language and distinguish binding decisions from non-binding notes.
- NFR-2: The contracts must preserve immutable identity, traceable provenance, explicit changes/conflicts, versioned approved state, reversible file modification, deterministic synchronization, non-authoritative AI output, and rebuildable derived data.
- NFR-3: The ADR set must be internally consistent and cross-referenced so reviewers can trace dependencies and migration impact.
- NFR-4: The ADR set must be reviewable without an application codebase, while remaining concrete enough to guide later implementation and verification.
- NFR-5: No application code, schema, API, library dependency, or infrastructure configuration is part of this specification's implementation scope.

## Acceptance Criteria

- [ ] AC-1: Exactly eight ADR files exist under docs/adr/ with the specified filenames and no duplicate or replacement filenames.
- [ ] AC-2: Every ADR visibly states its number, title, date, and Status: Accepted baseline.
- [ ] AC-3: Every ADR contains the five required core sections with non-empty content: Context, Decision, Alternatives, Consequences, and Migration impact.
- [ ] AC-4: Every ADR defines technology-neutral logical fields, state transitions, and MVP invariants; no concrete technology is made binding.
- [ ] AC-5: Every ADR explicitly identifies its binding MVP/Camera Vertical Slice scope and labels future-domain guidance non-binding.
- [ ] AC-6: Every ADR contains Related ADRs, dependency references, and an implementation-order note consistent with the foundation dependency chain.
- [ ] AC-7: Every ADR contains concrete acceptance checks that a later implementation/reviewer can execute or inspect.
- [ ] AC-8: Every ADR contains a normal-flow scenario and a relevant failure/edge scenario.
- [ ] AC-9: Every ADR contains traceability to Architecture v1.1, the current architecture audit, related ADRs, and its acceptance checks.
- [ ] AC-10: Every ADR documents forward migration and rollback or supersession impact.
- [ ] AC-11: Every ADR lists unresolved implementation choices as non-binding open questions.
- [ ] AC-12: The ADR set defines supersession by new ADR creation, historical preservation, explicit predecessor links, and migration path.
- [ ] AC-13: Markdown/reference validation passes, the ADR set is internally cross-referenced, and no application code/schema/API changes are introduced.

## Scenarios

### Scenario 1: Generate the accepted ADR baseline

**Given** the Architecture v1.1 prompt, the current architecture audit, and no existing application ADRs  
**When** Phase 0B is implemented  
**Then** exactly eight named ADR files are created under docs/adr/, each is marked Status: Accepted baseline, and each satisfies the required sections and traceability rules.

### Scenario 2: Implement and review against a contract

**Given** an implementer proposes a Project/Camera change  
**When** the proposal is reviewed against the relevant ADRs  
**Then** the reviewer can verify logical fields, state transitions, invariants, acceptance checks, and MVP scope without choosing a specific library, database, or infrastructure product.

### Scenario 3: Replace an implementation technology

**Given** a compliant implementation changes its library, database, or infrastructure  
**When** the implementation is checked against the ADR set  
**Then** the change remains valid if all binding contracts and acceptance checks still pass, and no ADR must be changed solely because the technology changed.

### Scenario 4: Supersede an accepted decision

**Given** a later requirement conflicts with an accepted ADR  
**When** the architecture is changed  
**Then** a new ADR supersedes the predecessor, the predecessor remains historically traceable, and the new ADR documents forward migration and rollback/compatibility handling.

### Scenario 5: Handle incomplete evidence

**Given** an implementation detail cannot be decided from the current repository or Architecture v1.1  
**When** the ADR is written  
**Then** the detail appears in Open questions as non-binding guidance and is not silently promoted into a contract or invariant.

### Scenario 6: Verify cross-ADR dependencies

**Given** a reviewer evaluates an ADR that depends on identity, authority, revisions, or ChangeSets  
**When** they follow its Related ADRs and dependency/order note  
**Then** the dependency chain is explicit, consistent, and sufficient to determine implementation sequence.

## Technical Notes

- The required repository paths are docs/adr/ and docs/architecture/CURRENT_ARCHITECTURE.md.
- The eight ADR filenames and the five core section names are fixed by this specification.
- The target contract is technology-neutral. PostgreSQL/PostGIS, Excel libraries, message brokers, mobile frameworks, and authorization products may be discussed only as replaceable options.
- The ADR set is documentation-only. Implementation tasks must be generated after this spec is approved; the spec must not contain a detailed task list.
- The Phase 0B ADR set is the next architecture artifact after the completed repository audit and precedes Project Core, canonical entities, Managed Excel, and geometry implementation.

## Task Links

Tasks will be linked here after /kn-plan --from @doc/specs/2026-08-09/phase-0b-architecture-decision-records is approved and executed.

## Open Questions

- [ ] None blocking the spec. Technology selection, deployment topology, concrete schema encoding, and framework choices remain intentionally non-binding and belong to later implementation planning.
