# Module Boundaries

## Ownership table

| Module | Owns | Does not own |
| --- | --- | --- |
| `project` | Project identity and lifecycle | Physical root-directory deletion or file writes |
| `datacenter` | Source files, import, mapping, Raw, file versions and import quality | Design geometry or field observations |
| `design` | Designed geometry, revisions and map presentation | Source parsing and physical write-back |
| `operate` | Field packages, observations, offline queue, sync and conflicts | Canonical source-file serialization |
| `organize` | Group/tag classification, memberships, lifecycle, assignments and write-back intent | Direct filesystem mutation |
| `dashboard` | Read models, KPI, alerts and forecasts | Canonical mutation |
| `platform/shared` | Auth, persistence ports, clock, errors, audit and outbox contracts | Product-specific view state |

## Rules

1. Every application use case is project-scoped.
2. REST route paths and wire payloads are compatibility contracts.
3. Cross-feature behavior uses shared contracts or application ports, never private imports.
4. All canonical mutations retain provenance, revision, ChangeSet, audit and outbox behavior.
5. Derived dashboard data is rebuildable and never becomes the source of truth.
6. Compatibility façades may delegate during migration, but new code must target the owning module.
