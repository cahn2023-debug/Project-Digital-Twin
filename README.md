# Project Digital Twin

Project Platform baseline for the Camera Vertical Slice.

## Workspace

- `apps/web`: React/Vite browser application.
- `apps/server`: FastAPI service and domain import pipeline.
- `apps/desktop`: Tauri 2 shell and Rust desktop commands.
- `packages/domain`: shared TypeScript contract types.
- `crates/desktop-core`: testable Rust filesystem/hash primitives.
- `migrations`: canonical PostgreSQL/PostGIS schema migrations.
- `docs/adr`: accepted architecture contracts.

## Development

```text
corepack pnpm install
corepack pnpm dev
corepack pnpm test
```

The server currently uses an in-memory repository for the first executable slice. PostgreSQL/PostGIS migrations are included and the repository boundary is ready for the persistent adapter.

## Invariants

Entity IDs are immutable, revisions are append-only, source locators are retained, geometry edits require a base revision, and derived projections are not authoritative.

