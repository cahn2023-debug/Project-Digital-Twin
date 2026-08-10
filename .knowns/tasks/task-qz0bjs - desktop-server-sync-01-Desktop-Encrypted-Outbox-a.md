---
id: qz0bjs
title: "[desktop-server-sync-01] Desktop Encrypted Outbox and Hybrid Replay Worker"
status: done
priority: high
labels: []
createdAt: '2026-08-10T02:13:29.013Z'
updatedAt: '2026-08-10T03:54:18.356Z'
completedAt: '2026-08-10T02:23:10.856Z'
timeSpent: 0
spec: specs/2026-08-10/desktop-server-sync
---
# [desktop-server-sync-01] Desktop Encrypted Outbox and Hybrid Replay Worker

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish desktop SQLite encrypted outbox queue and hybrid replay worker (background retry + manual Sync Now trigger) sending client_id, workspace_id, entity metadata and field changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Encrypted outbox persists PENDING mutations with stable client_id, workspace_id and user_id metadata.
- [x] #2 Hybrid replay supports background/manual sync, batch acknowledgements, conflict states and retry handling.
- [x] #3 Desktop-core tests cover client metadata and offline/online replay behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Task @task-qz0bjs

### Overview
Xây dựng cơ chế Encrypted Outbox Queue và Replay Worker mở rộng cho ứng dụng Desktop trong crates/desktop-core (Rust) và Tauri backend API.

### Locked Decision Alignment
- D1 (Conflict Strategy): Replay Worker tiếp nhận phản hồi ACK hoặc CONFLICT_STAGED từ Server để cập nhật trạng thái STAGED_FOR_REVIEW hoặc SYNCED.
- D2 (Hybrid Sync): Hỗ trợ cả Background auto-replay (khi online) và hàm kích hoạt thủ công trigger_manual_sync.
- D3 (Client Identity): Đảm bảo khởi tạo và duy trì client_id (UUID thiết bị) cố định trong SQLite, tự động đính kèm client_id, workspace_id, user_id vào mọi payload gửi lên Server.

### Steps
1. Bổ sung Client Identity & Metadata vào Local DB (crates/desktop-core/src/auth.rs / db_encrypted.rs):
   - Khởi tạo và lưu trữ client_id (UUID v4) cố định trong bảng metadata của SQLite Encrypted DB nếu chưa có.
   - Thêm struct SyncPayloadEnvelope chứa client_id, workspace_id, user_id, entity_type, entity_id, action, timestamp, mutation_id, field_changes.

2. Cập nhật Outbox Queue & Mutation Engine (crates/desktop-core/src/mutation.rs):
   - Cập nhật hàm enqueue_mutation tiếp nhận client_id, workspace_id, user_id và gói thành JSON SyncPayloadEnvelope.
   - Bổ sung đếm và lọc các mutation event theo trạng thái (PENDING, SYNCED, CONFLICT_STAGED, FAILED).

3. Nâng cấp Replay Engine & Sync Endpoint Client (crates/desktop-core/src/replay.rs & server_sync.rs):
   - Mở rộng ReplayEngine::replay_pending và trigger_manual_sync hỗ trợ gửi lô (batch up to 100 mutations) tới Server POST /api/v1/sync/reconcile-batch.
   - Xử lý các mã phản hồi từ Server: 200 OK (SYNCED), 409 Conflict (STAGED_FOR_REVIEW), và lỗi mạng (tăng retry_count kèm exponential backoff logic).

4. Expose Tauri / FFI Commands cho Desktop UI:
   - Bổ sung lệnh Tauri trigger_sync_now và get_sync_status cho phép Frontend Desktop bấm nút Đồng bộ ngay và xem số lượng mutation đang chờ.

5. Unit & Integration Tests (crates/desktop-core/src/mutation.rs & replay.rs):
   - Thêm unit test xác minh client_id được sinh duy nhất và đính kèm vào mọi Outbox mutation event.
   - Thêm unit test giả lập gửi batch mutation thành công và xử lý trạng thái offline/online.

### Verification Plan
- Chạy cargo test -p desktop-core đảm bảo tất cả unit tests của mutation, replay, server_sync pass 100%.
- Kiểm tra tính đầy đủ của client_id, workspace_id, user_id trong payload.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented SQLite encrypted outbox queue and hybrid replay worker in crates/desktop-core. Added client_id, workspace_id, user_id SyncPayloadEnvelope metadata and trigger_manual_sync. System Decision Impact: none — Extended desktop-core SQLite Encrypted Outbox queue to embed client_id, workspace_id, user_id metadata into mutation payloads for desktop-server sync. Spec Decision Compliance: D1=pass, D2=pass, D3=pass.
Flow audit: implementation ACs added and verified against the completed outbox/replay implementation.
Fixes recorded: client_id and mutation_id now use UUID v4; manual replay posts real envelopes to /api/v1/sync/reconcile-batch using PROJECT_SYNC_SERVER_URL or an explicit server URL, and maps ACK/conflict/failure statuses to the encrypted outbox.
Review: PASS after UUID v4, real batch transport, background replay worker and persisted retry-count fixes. P1=0; server persistence across restarts deferred to review follow-up task 0x820i.
<!-- SECTION:NOTES:END -->

