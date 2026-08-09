---
id: swito3
title: Implement Project Platform baseline and Camera Vertical Slice
status: in-progress
priority: high
labels:
  - implementation
  - camera-vertical-slice
  - architecture
createdAt: '2026-08-09T09:04:06.554Z'
updatedAt: '2026-08-09T15:39:00.141Z'
timeSpent: 9672
assignee: '@me'
spec: specs/2026-08-09/phase-0b-architecture-decision-records
fulfills:
  - FR-1
  - FR-2
  - FR-3
  - FR-4
  - FR-5
  - FR-6
  - FR-7
  - FR-8
  - FR-9
  - FR-10
  - FR-11
  - FR-12
  - FR-13
  - FR-14
  - FR-15
  - FR-16
  - FR-17
  - FR-18
  - FR-19
  - FR-20
  - FR-21
  - NFR-1
  - NFR-2
  - NFR-3
  - NFR-4
  - NFR-5
---
# Implement Project Platform baseline and Camera Vertical Slice

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the approved Project Platform execution plan from the documentation-only repository. Begin with the eight Phase 0B ADR contracts, then establish the React/Vite + Tauri/Rust + FastAPI + PostgreSQL/PostGIS + SQLite baseline and the first complete Camera foundation slice. Preserve immutable identity, provenance, versioned revisions, explicit ChangeSets/conflicts, deterministic idempotent sync, rebuildable projections, and reversible file operations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Eight accepted ADR files exist with required sections, dependencies, scenarios, traceability, and migration handling.
- [x] #2 React/Vite, Tauri/Rust, FastAPI, PostgreSQL/PostGIS migration, SQLite manifest, CI, and Docker development baseline are present.
- [x] #3 Camera import, provenance, identity/revisions, geometry conflict behavior, assignment, FieldPackage, idempotent observations, approval, AS_BUILT, sync events, dashboard, and write-job boundaries are covered by tests.
- [x] #4 Managed workbook write-back verifies source hash, preserves unmanaged content in round-trip fixtures, creates a backup, and rejects stale files.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — production readiness

### Mục tiêu và giả định

Hoàn thiện các phần còn thiếu để phát hành pilot có kiểm soát cho Camera Vertical Slice + Organize, với PostgreSQL/PostGIS là canonical store, desktop Windows là client local-first, web/API chạy qua HTTPS và mọi thay đổi vẫn giữ provenance, ChangeSet, revision, audit, conflict và khả năng restore.

Giả định triển khai mặc định để lập kế hoạch: server/API và web đóng gói bằng container, PostgreSQL/PostGIS chạy private/managed hoặc service riêng, desktop phát hành Windows installer có ký số. Nếu target cloud, IdP hoặc chính sách tile khác, chỉ các adapter/deploy files thay đổi; domain contracts không đổi.

### Thứ tự thực hiện

1. **Đóng băng baseline và chuẩn hóa release contract** — trước mọi thay đổi runtime, tách/ghi nhận worktree hiện đang dirty, tạo checkpoint commit có thể rollback; chuẩn hóa uv sync --locked, corepack pnpm install --frozen-lockfile, .env.example, versioning và cấu hình CORS/API base. Cập nhật README.md và tạo release-readiness checklist.
   Verify: clean checkpoint, dependency install tái lập được, pnpm typecheck/test/build, uv run --project apps/server pytest, cargo fmt/test/check, git diff --check đều pass.

2. **Thay in-memory store bằng PostgreSQL/PostGIS thật** — hoàn tất task ngvcdd, giữ service boundary hiện tại nhưng thêm repository/adapter PostgreSQL (khuyến nghị psycopg 3 sync pool vì endpoint hiện là sync), để CameraStore chỉ còn test fake; wire chọn store theo DATABASE_URL trong apps/server/app/main.py/lifespan. Đồng bộ migrations/0001_initial.sql với toàn bộ model đang dùng: project lifecycle/root path, entities/cameras/revisions, source files/versions/locators/raw, ChangeSets/items/conflicts/approvals, outbox/cursor, audit, Organize memberships/lifecycle, write jobs và idempotency/unique constraints. Mọi approve/sync/write-back phải là transaction; outbox publish và cursor phải restart-safe.
   Verify: migration trên DB sạch và DB nâng cấp, integration tests chạy với PostGIS thật, restart không mất dữ liệu, duplicate idempotency không tạo bản ghi mới, revision conflict/approval/outbox cursor và project isolation đều pass; production không khởi động bằng in-memory store.

3. **Hoàn tất desktop ingestion/sync runtime** — bổ sung queue worker thực sự sau watcher hiện có trong apps/desktop/src-tauri/src/lib.rs và crates/desktop-core/src/lib.rs: claim/retry/FAILED jobs, gửi preview/ChangeSet lên API, reconnect và cursor sync, persist sau restart, self-write suppression và root-path permission boundary. Mở rộng apps/desktop/src/main.ts chỉ với các command cần cho scan/status/retry/sync. Không coi polling hiện tại là hoàn tất watcher/sync.
   Verify: test locked/unstable file, debounce, restart, retry/backoff, reconnect, idempotent re-import, self-write và cursor recovery; smoke test desktop với API/PostgreSQL thật.

4. **Đóng wave Organize write-back an toàn** — tiếp tục task bl6p7t: execute endpoint chỉ cho project editor, bắt buộc preview confirmation, re-check hash/revision/lock/mapping/conflict, hỗ trợ in-place/new-file và PER_FILE/ALL_OR_NOTHING; ghi backup, immutable file version, audit before/after/correlation, restore bằng job/version mới; tích hợp self-write provenance với worker bước 3. Giữ nguyên các adapter Excel/Markdown/TXT/Word và không ghi file trước xác nhận.
   Verify: AC-8..AC-11 của doc specs/2026-08-09/organize-data-classification-grouping-and-source-management pass với failure/rollback/restore fixtures và không tạo duplicate import.

5. **Thay header giả bằng authentication/authorization production** — trong apps/server/app/authorization.py và boundary mới cho auth, xác thực Bearer OIDC/OAuth2 JWT qua issuer/audience/JWKS cấu hình bằng environment; map subject/claims vào Principal, project membership và Role từ canonical DB. Bỏ default x_actor/x_role có đặc quyền; API project-scoped yêu cầu principal thật, health/readiness là ngoại lệ có chủ đích. Giữ quyền tách biệt read/edit/approve/audit-export/restore, audit actor lấy từ token và test viewer/editor/approver/cross-project/expired-token/unknown-role.
   Verify: không endpoint mutation nào dùng identity từ request body hoặc header tùy ý; secret không nằm trong repo; CORS allow-list và security headers được cấu hình theo environment.

6. **Đóng production operations và phát hành artefact** — thêm server/web container build, migration entrypoint, production configuration/secrets, private PostGIS connectivity, TLS/reverse-proxy contract, backup/restore runbook và rollback migration policy; cập nhật .github/workflows/ci.yml thành CI + integration PostGIS + artifact publishing. Bật Tauri bundling trong apps/desktop/src-tauri/tauri.conf.json, cấu hình NSIS/MSI, Windows build/signing và release artifact. docker-compose.yml hiện chỉ là dev PostGIS với credential mặc định, không dùng trực tiếp cho production.
   Verify: deploy fresh environment từ artifact, migration/rollback rehearsal, health probes, backup restore, Windows installer install/uninstall/upgrade và configuration-secrets scan pass.

7. **Observability, performance và pilot acceptance** — thêm structured logs với correlation/causation/request IDs, /health/live, /health/ready, metrics cho request latency/error, import throughput/failures, queue depth/retry age, outbox lag, conflicts, write-back failures và audit completeness; không ghi token/secret/Raw nhạy cảm vào log. Tạo fixture/performance harness cho 1k/10k/50k records, đo import/snapshot/sync/approval/write-back và bundle size; theo D41, đo baseline trước rồi chốt ngưỡng pilot có owner. Chạy pilot bằng fixture đại diện + file thật của Project, ghi import duration, mapping/unmapped/invalid, conflict rate, queue recovery, restore success và user sign-off.
   Verify: dashboard/runbook có metric và alert owner, performance report được lưu, bundle warning được xử lý hoặc chấp thuận có căn cứ, pilot exit criteria đạt.

8. **Release gate và hoàn tất Knowns/SDD** — task j95djb chạy integrated domain/API/UI/desktop/write-back tests; bổ sung Spec Decision Compliance còn thiếu cho task gốc D1–D8 và toàn bộ Organize D1–D18, sửa các SDD errors/warnings, kiểm tra audit trace end-to-end, source locator, project isolation, conflict blocking, restore/self-write. Chỉ đánh dấu swito3 done khi mọi child task (ngvcdd, m3z66g, bl6p7t, j95djb) đạt AC và release checklist có bằng chứng.
   Verify: knowns validate --strict, SDD validation 0 errors/0 warnings, full CI xanh, smoke E2E trên môi trường deploy, rollback drill pass và có go/no-go record.

### Phụ thuộc và rủi ro

- Bước 2 là nền tảng cho bước 5–8; bước 3 phụ thuộc API/persistence; bước 4 phụ thuộc bước 2–3. Bước 5–6 có thể chạy song song sau khi contract persistence ổn định.
- ngvcdd và m3z66g hiện chưa có AC/plan chi tiết; cần tách triển khai theo các bước trên trước khi thực thi. Desktop sync và MapLibre production decision hiện chưa có task riêng; phải ghi nhận vào task wave hoặc tạo task con trước khi bắt đầu.
- Spec MapLibre specs/2026-08-09/maplibre-basemap-for-design còn draft và Google public tiles chỉ là experimental; không go-live với endpoint đó nếu chưa có review quyền sử dụng/SLA. Mặc định an toàn là production-approved vector/provider hoặc tắt các mode thử nghiệm.
- Worktree hiện có nhiều thay đổi chưa commit; không được overwrite hoặc trộn chúng khi tạo checkpoint.

### Plan check

- AC coverage: AC-1..AC-4 của task swito3 đã có bằng chứng; các blocker triển khai còn lại được phủ bởi bước 2–8 và AC của ngvcdd/m3z66g/bl6p7t/j95djb.
- Dependency: không có vòng lặp; thứ tự là baseline → persistence → desktop/write-back → auth/ops → performance/pilot → release.
- Risk: persistence thật, JWT/IdP, production deployment/signing và tile provider là high-risk; integration tests và explicit approval gates bắt buộc.
- Scope: đây là project rollout plan gồm các wave độc lập; không triển khai toàn bộ trong một session.
- Spec Decision Compliance: Phase 0B D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass. Các spec Organize/ingestion/lifecycle/MapLibre phải được đánh giá lại ở task verification trước go-live.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation using the Knowns kn-implement-equivalent workflow; no existing application code was found, so new baseline files will be created.
Completed: eight accepted Phase 0B ADRs, target architecture, pnpm/Cargo workspace, React/Vite web shell, Tauri 2 shell, Rust desktop-core hashing/safe-write primitives, SQLite manifest schema, PostgreSQL/PostGIS migration, FastAPI Camera import/geometry/assignment/FieldPackage/observation/approval/sync/dashboard/write-job endpoints, server authorization boundary, managed workbook writer, Docker PostGIS service, and CI workflow. Validation: Knowns strict validation passed; TypeScript typecheck/test/build passed; Python pytest 7 passed; cargo fmt/check/test passed; git diff --check passed. Remaining production work is tracked as subtasks: PostgreSQL adapter, real desktop watcher/local sync execution, MapLibre UI, authentication integration, deployment/observability, and pilot-scale performance.
Implementation started: preflight complete; preserving existing dirty worktree. Beginning production persistence/runtime wave.
Progress: added apps/server/app/persistence.py with transactional PostgresCameraStore/request context and safe domain-state codec; added runtime_store_snapshots migration; wired DATABASE_URL/APP_ENV production guard, environment CORS and PostgreSQL readiness. uv lock updated with psycopg. Verification: uv run pytest 36 passed; compileall and codec smoke passed. Docker Compose config is valid but Docker daemon unavailable, so PostGIS integration remains pending.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass. Current implementation wave is intentionally not complete: relational Postgres integration requires a running PostGIS service; OIDC project-claim validation and production smoke/pilot remain to be exercised.
Spec Decision Compliance: D8=pass
Spec Decision Compliance: D1=pass
Spec Decision Compliance: D2=pass
Spec Decision Compliance: D3=pass
Spec Decision Compliance: D4=pass
Spec Decision Compliance: D5=pass
Spec Decision Compliance: D6=pass
Spec Decision Compliance: D7=pass
Spec Decision Compliance: D8=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass
Progress verification: implemented durable Postgres adapter boundary and runtime snapshot migration, production OIDC/JWT auth gate, request IDs/structured logs/metrics/readiness, production Docker artifacts and release config, Windows NSIS bundling, desktop pending-job claim/retry/complete bridge, and 1k/10k performance baseline. Verification: server 41 passed (1 existing Starlette/httpx warning), Python compileall passed, TypeScript typecheck/test/build passed with existing 1.2 MB bundle warning, Rust fmt/10 tests/check passed, compose config passed, git diff --check passed, Knowns validation passed, SDD validation passed with 0 errors/0 warnings. Remaining: run PostGIS migration/integration and production OIDC/deployment/backup smoke tests when Docker/target environment is available; relational decomposition beyond transitional snapshot remains open.
<!-- SECTION:NOTES:END -->

