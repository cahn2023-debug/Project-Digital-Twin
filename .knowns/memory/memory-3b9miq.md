---
id: 3b9miq
title: Tauri dev startup must launch the FastAPI workspace package
layer: project
category: failure
status: proposed
tags:
  - debug
  - tauri
  - pnpm
  - fastapi
  - project-lifecycle
createdAt: '2026-08-09T15:37:30.840Z'
updatedAt: '2026-08-09T15:37:30.840Z'
---

Root cause: the desktop beforeDevCommand only launched @project/web while the UI always calls localhost:8000, so health/project requests failed with ERR_CONNECTION_REFUSED. Fix: keep apps/server as a pnpm workspace package with a uvicorn dev script and run @project/web and @project/server in parallel from the workspace root.
