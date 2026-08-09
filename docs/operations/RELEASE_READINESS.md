# Release readiness

## Required configuration

- `APP_ENV=production`
- `DATABASE_URL` points to a private PostgreSQL/PostGIS database
- `CORS_ALLOW_ORIGINS` contains only the deployed web origins
- `POSTGRES_PASSWORD` and other credentials come from a secret manager
- TLS terminates at the deployment edge; the API is not exposed directly to the public internet

## Deployment order

1. Provision PostgreSQL/PostGIS and verify backups.
2. Run `deploy/compose.production.yml` migration once against the target database.
3. Start the API and verify `/health/live`, `/health/ready` and `/metrics`.
4. Start the web artifact and run the project-list, import-preview, approval and audit smoke flows.
5. Install the signed Windows desktop artifact and verify local manifest, scan queue and reconnect behavior.

## Go/no-go evidence

- Clean migration on an empty database and an upgrade rehearsal.
- Backup restore rehearsal with project isolation verified.
- Full TypeScript, Python and Rust checks.
- API/PostGIS integration tests and representative real-file pilot metrics.
- Authentication, authorization, conflict, restore and self-write suppression checks.
- Rollback owner, incident contact and release artifact checksums recorded.
