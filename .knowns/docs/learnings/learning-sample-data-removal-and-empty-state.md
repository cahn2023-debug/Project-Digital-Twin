---
title: "Learning: sample data removal and empty state UI"
description: Reusable patterns and learnings from removing pre-seeded data and implementing zero-state initialization across server and frontend UI.
createdAt: '2026-08-10T04:41:00.000Z'
updatedAt: '2026-08-10T04:41:00.000Z'
tags:
  - learning
  - sample-data
  - empty-state
  - ui
  - backend
---

## Patterns

### Zero-Data Domain Initialization
- **What:** Domain repositories (`CameraStore`) initialize with empty collections (`{}`) by default and expose an explicit `is_empty() -> bool` method.
- **When to use:** In production/default runtimes where data must strictly be created by user action rather than auto-seeded.
- **Source:** @doc/specs/2026-08-10/sample-data-removal

### UI Empty State Replacement
- **What:** Replace static mock fallback arrays (`cameraRows`, `sourceRows`) inside React feature modules with empty default arrays `[]` and render explicit Empty State cards with CTA buttons ("Thêm nguồn dữ liệu", "Tạo dự án mới").
- **When to use:** Across all web/desktop tabs when no user records exist for the selected workspace.
- **Source:** @task-a7nrud

## Decisions

### Safe DB Reset CLI Utility
- **Chose:** Providing a dedicated CLI module (`python -m app.clean_sample_data`) to reset store snapshots to `{}` without dropping PostgreSQL or SQLite tables.
- **Over:** Requiring manual `DROP TABLE` or `DELETE FROM` statements during development.
- **Tag:** GOOD_CALL
- **Outcome:** Clean reset execution for developers without risking schema corruption.
- **Recommendation:** Always pair zero-data startup features with a clean reset helper script.

## Failures

### Environment Test Runner Mismatch
- **What went wrong:** Running global `pytest` directly failed with `ModuleNotFoundError: No module named 'openpyxl'`.
- **Root cause:** The test runner was executed outside the managed Virtualenv (`.venv`).
- **Time lost:** ~5 minutes troubleshooting missing imports.
- **Prevention:** Always execute Python backend tests using `uv run pytest` inside `apps/server`.
