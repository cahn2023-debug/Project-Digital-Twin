---
id: trbw1k
title: "[local-file-ingestion-04] Implement desktop watcher, SQLite queue and offline sync"
status: done
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - desktop
  - sync
createdAt: '2026-08-09T09:23:54.926Z'
updatedAt: '2026-08-09T12:27:51.782Z'
completedAt: '2026-08-09T11:51:44.447Z'
timeSpent: 10
assignee: '@me'
parent: swito3
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-11
  - AC-14
order: 40
---
# [local-file-ingestion-04] Implement desktop watcher, SQLite queue and offline sync

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement manual scan and scoped Rust file watching/debounce/hash jobs, SQLite manifest persistence, desktop sync queue execution, idempotent retry/conflict handling, and self-write event suppression against the existing API contracts. MapLibre UI is deferred outside this spec wave.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Manual scan and registered-directory watcher enqueue only stable, readable, unlocked files after debounce.
- [x] #2 SQLite queue and sync state survive restart; transient failures retry with bounded backoff and permanent failures become visible.
- [x] #3 Duplicate file versions and software-generated write-back events do not create duplicate imports.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend crates/desktop-core/src/lib.rs and apps/desktop/manifest.sql with registered directories, scan state, debounce metadata, retry status, queue attempts and self-write markers while preserving the task-01 file/version contract.
2. Implement manual scan and Rust watcher execution behind apps/desktop/src-tauri/src/lib.rs and expose only the commands needed by apps/desktop/src/main.ts; enqueue files only after size/mtime stability and a readable/unlocked check.
3. Implement durable SQLite queue processing with bounded backoff, visible FAILED state, idempotency keys, restart recovery and server reconnect handoff; leave canonical ChangeSet application to task 05.
4. Add tests for rapid file events, locked files, retry/backoff, restart persistence, duplicate queue keys, reconnect and self-generated write suppression.
5. Validate with cargo fmt/check/test, desktop/domain checks, Knowns validation and git diff --check.

## Dependencies and scope

- Depends on local-file-ingestion-01 and precedes ChangeSet import.
- The former MapLibre portion of this task is intentionally deferred outside this spec wave.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan check refinement: AC-12 duplicate-version ownership remains with local-file-ingestion-01; this task owns watcher/queue behavior.
Full-wave planning pass: plan saved before implementation and baseline commit.
Done: added recursive local scanner, debounce observation state, idempotent FILE_SCAN queue, bounded retry/FAILED state, best-effort unreadable-file failures, Tauri start/scan/stop commands and desktop TS invoke APIs. MapLibre remains deferred outside this spec wave. Verification: cargo fmt; cargo test -p desktop-core (8 passed); cargo check -p project-digital-twin-desktop passed; corepack pnpm --filter @project/desktop typecheck passed; Knowns validation passed; git diff check clean aside line-ending warnings. Review: PASS after fixing P2 retry integration; no remaining P1/P2/P3 findings. System Decision Impact: candidate @decision/20260809-1851-desktop-watcher-queues-stable-local-file-scans-idempotently (added) — establishes the desktop watcher/queue boundary. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D52=pass

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass
<!-- SECTION:NOTES:END -->

