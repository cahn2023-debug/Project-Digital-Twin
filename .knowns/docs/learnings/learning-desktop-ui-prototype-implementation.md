---
title: 'Learning: desktop UI prototype implementation'
description: Reusable patterns and environment learnings from implementing the Project Platform desktop UI prototype.
createdAt: '2026-08-09T09:54:37.769Z'
updatedAt: '2026-08-09T09:54:37.769Z'
tags:
  - learning
  - ui
  - desktop
  - react
---

# Learning: desktop UI prototype implementation

Source: @task-l0g5hy

## Patterns

### Prototype-to-React visual parity

- **What:** Represent repeated module navigation as typed configuration, keep prototype values in local fixtures, and render shared UI through small presentational components such as status badges, panels, KPI cards, alerts, and map mockups.
- **When to use:** When a static HTML prototype must become an interactive React shell before backend data contracts are ready.
- **Example:** `modules` owns tab/sidebar metadata while `Panel`, `KpiCard`, `StatusBadge`, and view components own presentation.
- **Source:** @task-l0g5hy

## Decisions

### Keep visual parity isolated from backend integration

- **Chose:** Implement the prototype in `apps/web`, preserve the existing health check, and leave API/native/MapLibre behavior to the related implementation work.
- **Over:** Introducing new UI dependencies or expanding this visual task into backend and Tauri changes.
- **Tag:** GOOD_CALL / TRADEOFF
- **Outcome:** The UI could be completed and verified with the existing TypeScript/Vite boundary while keeping the functional desktop work independently schedulable.
- **Recommendation:** Use fixture-driven visual shells for prototype parity, then replace fixtures behind stable boundaries in follow-up tasks.

## Failures

### Missing browser runtime for visual verification

- **What went wrong:** The repository had no Playwright, Puppeteer, Chrome, or equivalent runtime, so automated 1280x800/narrow screenshots could not be produced.
- **Root cause:** The frontend package has no browser E2E dependency or configured visual verification harness.
- **Time lost:** Low; typecheck, build, zero-test script, CSS breakpoints, and diff checks still completed successfully.
- **Prevention:** Add a browser-based smoke/e2e verification path before the next UI-heavy task if screenshot-level regression checks are required.
