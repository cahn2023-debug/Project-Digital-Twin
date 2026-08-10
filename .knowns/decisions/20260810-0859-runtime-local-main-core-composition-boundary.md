---
id: 20260810-0859-runtime-local-main-core-composition-boundary
title: Runtime-local Main-core composition boundary
status: draft
supersedes: []
supersededBy: []
tags:
  - architecture
  - main-core
  - module-boundaries
  - composition
sources:
  - '@task-0yuitq'
  - '@task-kxz78p'
relatedDocs:
  - docs/architecture/CURRENT_ARCHITECTURE.md
  - docs/architecture/TARGET_ARCHITECTURE_V1.md
  - docs/architecture/MODULE_BOUNDARIES.md
relatedTasks:
  - 0yuitq
  - kxz78p
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'related doc "docs/architecture/CURRENT_ARCHITECTURE" is not readable: doc "docs/architecture/CURRENT_ARCHITECTURE" not found'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T01:59:19.849Z'
createdAt: '2026-08-10T01:59:19.849Z'
updatedAt: '2026-08-10T01:59:19.849Z'
---

## Context

Project Digital Twin has five product-tab boundaries across server, web and domain packages, but app composition, project context and runtime command registration were previously concentrated in main.py, App.tsx and Tauri lib.rs. A single literal mixed-language Main-core folder would not be import-safe for Python and Rust.

## Decision

Use runtime-local main_core namespaces as the implementation of the product-facing Main-core area: apps/server/app/main_core for FastAPI composition and dependency wiring, apps/web/src/main_core for shell/project context/navigation/notifications, and apps/desktop/src-tauri/src/main_core for Tauri runtime composition and command registration. main_core may compose public module interfaces but must not own domain rules, persistence implementation, authentication implementation or physical file writes. Preserve existing REST/API, database, command and runtime contracts.

## Alternatives Considered

Keep all composition in main.py/App.tsx/lib.rs; rejected because it preserves cross-boundary coupling. Create a literal repository-root Main-core folder containing mixed Python/TypeScript/Rust imports; rejected because it conflicts with language/package module rules.

## Consequences

Bootstrap entrypoints become thin compatibility surfaces, feature modules keep their ownership, and future runtime changes can be isolated. Compatibility barrels remain during migration. The architecture docs must treat Main-core as a composition boundary rather than a shared domain bucket.
