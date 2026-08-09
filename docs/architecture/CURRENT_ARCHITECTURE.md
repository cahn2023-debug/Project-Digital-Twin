# Current Architecture Audit

**Project:** Project Digital Twin
**Audit date:** 2026-08-09
**Target reference:** Project Platform Architecture v1.1, supplied with this task
**Audit status:** Baseline complete; implementation has not started

## Audit Scope and Evidence

This document records the repository state before application implementation. The audit covers the repository, source tree, project manifests, tests, runtime configuration, and the capabilities named in Project Platform Architecture v1.1.

The following evidence was collected:

- `rg --files -uu -g '!.git/**'` found only agent guidance, compatibility instructions, Knowns metadata, and CodeGraph runtime files.
- `git ls-files` returned no tracked files.
- `git status --short` shows the repository contents as untracked bootstrap files.
- `git log --oneline -5` found no commit history.
- CodeGraph is present, but its repository query returned no relevant code; the Knowns status reports zero indexed symbols and relations.
- No application source, project manifest, test harness, migration, or runtime configuration was found outside `.knowns/` and `.codegraph/`.

`.knowns/` and `.codegraph/` are treated as agent/project tooling metadata, not as application architecture evidence.

## Current state

### Repository and implementation inventory

| Area | Evidence | Current result |
| --- | --- | --- |
| Source control baseline | No tracked files and no commit history | No versioned application baseline exists |
| Technology stack | No solution, project, package, workspace, or build manifest | Stack is not present or verifiable |
| Desktop architecture | No desktop application project or UI source | No desktop architecture exists in the repository |
| Database and migrations | No application database configuration or migration files | No canonical or local data store exists |
| GIS and geometry | No map, spatial, geometry, or PostGIS integration | No GIS architecture exists |
| Entity and data models | No domain source or schema files | Project, Intersection, Camera, Contractor, and WorkPackage models are absent |
| File registry and parsing | No parser, mapping, workbook, or managed-file implementation | Managed Excel is absent |
| ChangeSets and approval | No workflow, revision, approval, or event source | Authoritative mutation pipeline is absent |
| Sync and offline behavior | No client, server, cursor, conflict, or offline source | Local-first sync is absent |
| API and networking | No API routes, contracts, service host, or transport configuration | No application API is present |
| Authentication and permissions | No identity, role, policy, or authorization source | Permission behavior is absent |
| Dashboard and read models | No projection, metric, alert, or dashboard source | Dashboard behavior is absent |
| AI/evidence readiness | No provenance, locator, evidence, or AI integration source | AI-readiness implementation is absent |
| Tests and quality gates | No test projects, test files, CI build, lint, or performance harness | Automated verification is unavailable |
| Operations and technical debt | No executable application baseline to profile or review | Performance and debt are not verifiable |

The repository currently provides project guidance through `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `OPENCODE.md`, `.github/copilot-instructions.md`, and `KNOWNS.md`. These files define agent workflow and repository-memory conventions; they are not product components.

### Foundation gap matrix

| Foundation | Target contract | Current evidence and gap |
| --- | --- | --- |
| F1. Project + Entity Canonical Model | Stable UUID identity separated from mutable state | No project, entity, or revision model exists |
| F2. Managed File System | File identity, versions, physical locations, hashes, parser/writer profiles, and authority modes | No file registry or managed-file model exists |
| F3. ChangeSet + Approval | Explicit command-to-ChangeSet-to-validation-to-approval-to-mutation flow | No ChangeSet, approval, validation, or mutation pipeline exists |
| F4. Digital Twin Representation | Versioned representations such as `DESIGNED` and `AS_BUILT` | No canonical state or representation model exists |
| F5. Local-first Sync | Server authority, revisions, cursors, deltas, rebase, and explicit conflicts | No client projection, sync protocol, or conflict model exists |
| F6. Knowledge / AI Readiness | Source, revision, locator, entity, ChangeSet, and evidence traceability | No provenance or evidence model exists |

### System invariants

The target architecture requires the following invariants. None can currently be verified because the corresponding application implementation is absent:

- Entity identity is immutable.
- Source provenance is traceable.
- Raw evidence is immutable.
- Approved state is versioned.
- Changes are explicit.
- Conflicts are explicit.
- File modification is reversible.
- Synchronization is deterministic.
- AI output is non-authoritative.
- Derived data is rebuildable.

### Camera Vertical Slice gap

The required first slice is not implemented at any stage:

| Slice stage | Current status |
| --- | --- |
| Managed Camera Excel registration and import | Absent |
| DATACENTER catalog, parser, mapping, and canonical Camera | Absent |
| Camera `DESIGNED` position and map presentation | Absent |
| Contractor assignment and field package | Absent |
| OPERATE web/mobile, offline observation, GPS, and photos | Absent |
| Sync, revision checking, rebase, and conflict detection | Absent |
| ChangeSet, validation, approval, and `AS_BUILT` revision | Absent |
| Managed Excel write-back | Absent |
| DASHBOARD reconciliation and read models | Absent |

## Target state

Project Platform Architecture v1.1 defines five application surfaces—DATACENTER, DESIGN, OPERATE, ORGANIZE, and DASHBOARD—over one shared Project Data Core. The target system is desktop-first and local-first, with a server-authoritative canonical state and rebuildable client projections.

The target MVP includes `Project`, `Intersection`, `Camera`, `Contractor`, and `WorkPackage`. The first production-driven benchmark is the complete Camera Vertical Slice, from managed Excel import through designed geometry, assignment, offline field observation, synchronization, approval, `AS_BUILT`, write-back, and dashboard reconciliation.

The prompt names PostgreSQL/PostGIS as the canonical geometry direction, but this audit does not treat that as an implemented or locked repository choice. The actual stack must be selected after the repository has an application baseline.

## Reusable components

No product or application components are reusable because no application implementation is present.

The following repository tooling can be retained for future work:

- `KNOWNS.md` and the compatibility instruction files provide the established agent workflow and source-of-truth rules.
- `.knowns/` provides project task, validation, timer, and memory infrastructure.
- `.codegraph/` provides a code-indexing location, although it currently contains no indexed application symbols.

These tools should remain development infrastructure and should not be treated as the Project Data Core or a runtime dependency of the product.

## Components requiring refactor

No application components were identified for refactoring. There is no existing source to preserve, adapt, or safely classify as technical debt.

Once application source is introduced, the repository audit should be rerun before the first domain implementation so that reuse and refactor decisions are based on evidence rather than the target architecture alone.

## Components requiring replacement

No application components were identified for replacement. The repository contains no existing product subsystem that conflicts with the target architecture.

The only replacement risk is procedural: future implementation must not promote Knowns or CodeGraph metadata into product storage, canonical state, or domain services.

## Risks

- **No current implementation baseline:** technology, runtime topology, persistence, and deployment assumptions cannot be verified.
- **No versioned source baseline:** all present repository files are untracked and there is no commit history, so implementation should establish a deliberate baseline before broad changes.
- **No automated quality gates:** tests, build, lint, and performance checks must be introduced with the first application slice.
- **Architecture-to-code gap:** every foundation and every Camera Vertical Slice stage is currently absent; the first implementation must establish contracts before feature breadth.
- **Tooling readiness:** Knowns reports the C# language server as unavailable and its semantic project index as empty. This is not blocking the documentation audit, but it must be resolved if the future application uses C#.
- **Unknown stack risk:** selecting infrastructure before identifying a real application need would violate the prompt's thin-foundation and vertical-slice strategy.

## Migration strategy

The repository should move from bootstrap to implementation in the following order:

1. Establish a versioned application baseline and record the chosen stack, runtime boundaries, persistence approach, and test strategy.
2. Define the thin contracts and complete the separate Phase 0B ADR work for identity, authority, ChangeSets, revisions, sync, events, geometry conflicts, and retention.
3. Implement the smallest end-to-end Camera slice while preserving immutable identity, provenance, explicit changes/conflicts, revision history, reversible file operations, deterministic sync, and rebuildable derived data.
4. Add production feedback and hardening only after the Camera slice is observable and reconciles with its canonical state.

### Iteration 0–3 backlog

| Iteration | Intended outcome | Main evidence of completion |
| --- | --- | --- |
| Iteration 0 | Repository baseline, architecture contracts, and ADR preparation | Versioned source baseline, current architecture, contract definitions, and reviewed ADR set |
| Iteration 1 | Project identity, Entity Identity, and explicit Camera canonical model | Project and Camera data can be created with immutable UUID identity and typed state separation |
| Iteration 2 | Managed Camera Excel import and file registry | A contracted workbook can be registered, hashed, parsed, mapped, validated, and represented as an explicit ChangeSet with source locators |
| Iteration 3 | Camera `DESIGNED` point geometry | Camera and Intersection points can be displayed, edited, versioned, and compared without overwriting `AS_BUILT` state |

The next backlog item after Iteration 3 should be selected from observed Camera-slice feedback. Fiber, generalized workflow infrastructure, full materials, knowledge graph infrastructure, and advanced analytics remain outside the MVP audit scope.

## Validation summary

- Repository inventory completed; no application source, manifests, tests, or tracked files were found.
- CodeGraph query completed; no relevant code was found and the index reports zero symbols/relations.
- Knowns task and project validation completed with zero errors and zero warnings before this document was created.
- No application code, schema, API, or runtime configuration was changed by this audit.
- Automated application tests are unavailable because no application test harness exists.
- The only intended implementation artifact from this task is this architecture audit document.
