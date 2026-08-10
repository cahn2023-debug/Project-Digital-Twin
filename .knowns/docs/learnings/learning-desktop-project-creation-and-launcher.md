---
title: "Learning: Desktop Project Creation & Launcher"
description: Reusable patterns, UI zero-state architecture, and project switcher UX learnings from implementing desktop project launcher.
createdAt: '2026-08-10T18:10:00.000Z'
updatedAt: '2026-08-10T18:10:00.000Z'
tags:
  - learning
  - desktop
  - project-management
  - launcher
  - zero-state
---

## Patterns

### Zero-State AppShell View Dispatching
- **What:** In React Desktop apps with active project contexts (`useProjectContext`), when `currentProject` is `null` (zero-state), `AppShell` conditionally dispatches to a full-screen `WelcomeLauncherHub` instead of rendering standard application feature views.
- **When to use:** Multi-project applications where operations depend on an active workspace or project folder.
- **Source:** @doc/specs/2026-08-10/desktop-project-creation-and-open

### Recent Projects Persistence
- **What:** Persisting recent projects in `localStorage` (`pp-recent-projects`) and active project ID (`pp-active-project-id`) allows instant zero-delay restoration of project state across app reloads.
- **When to use:** Desktop client application state restoration.

## Decisions

### Dedicated Launcher Hub Over Embedded Dialog
- **Chose:** Full-screen Welcome Launcher Hub when no project is active.
- **Over:** Showing disabled feature views with a modal dialog overlay.
- **Tag:** GOOD_CALL
- **Outcome:** Clean, focused UX for users starting or opening a project without distraction or broken states in empty feature views.

## Failures

### SVG Icon Name Safety in Strict TypeScript
- **What went wrong:** Using icon names like `"folder"` or `"x"` before declaring them in the `IconName` type union resulted in build-time TypeScript type errors.
- **Root cause:** String literal union type `IconName` was missing newly added icon keys.
- **Prevention:** Always update `shared/types.ts` (`IconName`) whenever using new SVG icon components.

### React Hook Ordering during Vite HMR
- **What went wrong:** Adding new `useState` hooks into `useProjectContext` while the Vite dev server was running caused React HMR to throw "Should have a queue. You are likely calling Hooks conditionally".
- **Root cause:** Hot Module Replacement preserved previous component render hook index while the new code inserted an extra hook before `useEffect`.
- **Prevention:** Refresh the browser page (F5) or restart Vite dev server after introducing new React hooks in custom context providers.

### Project Fallback for Offline/Zero-Seed State
- **What went wrong:** When a new project was created without pre-seeded API data or when operating offline, `projects.find(...)` returned `undefined`, causing `currentProject` to stay `null` and locking the UI in launcher mode.
- **Root cause:** `currentProject` calculation did not fall back to `recentProjects` stored in `localStorage`.
- **Fix:** Provided an inline fallback construct in `currentProject` to resolve from `recentProjects` whenever the server API `projects` list does not contain the selected project ID.
