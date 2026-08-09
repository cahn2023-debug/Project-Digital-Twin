---
id: m3z66g
title: Add production auth, observability, deployment, and pilot gates
status: in-progress
priority: high
labels:
  - implementation
  - security
  - observability
  - pilot
createdAt: '2026-08-09T09:23:55.158Z'
updatedAt: '2026-08-09T15:37:15.412Z'
timeSpent: 0
assignee: '@me'
parent: swito3
---
# Add production auth, observability, deployment, and pilot gates

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate real authentication and project authorization, metrics/log correlation/health, deployment environments, Windows release packaging, 1k/10k/50k performance tests, and real-project pilot acceptance metrics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Production API requests require OIDC/JWT bearer authentication and project-scoped authorization; development header auth is not accepted in production.
- [ ] #2 Health/readiness, request IDs, structured request logs, metrics, CORS environment configuration, production compose and release-readiness documentation are present.
- [ ] #3 Windows NSIS packaging and CI release configuration are enabled, with 1k/10k/50k performance baseline and pilot evidence recorded.
- [ ] #4 Production smoke tests cover IdP, PostGIS, deployment, backup/restore and representative pilot flows before completion.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enforce OIDC/JWT bearer authentication for production API requests and project-scoped roles while keeping header auth development-only.
2. Ship request IDs, structured logs, health/readiness, metrics, environment CORS, production Docker Compose, server/web images and release-readiness runbook.
3. Enable Windows NSIS bundling and add release CI/configuration checks.
4. Run 1k/10k/50k baseline measurements and record pilot go/no-go evidence; leave task open until PostGIS/IdP/deployment smoke tests pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started under parent swito3: OIDC/JWT middleware, request metrics/IDs, readiness, production Docker artifacts, release config check, benchmark harness and NSIS bundling are implemented. IdP/PostGIS/deployment smoke tests remain pending.
<!-- SECTION:NOTES:END -->

