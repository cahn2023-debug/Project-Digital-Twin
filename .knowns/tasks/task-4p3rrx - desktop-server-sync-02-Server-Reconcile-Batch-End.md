---
id: 4p3rrx
title: "[desktop-server-sync-02] Server Reconcile Batch Endpoint & Field-level Auto-Merge Engine"
status: done
priority: high
labels: []
createdAt: '2026-08-10T02:13:32.178Z'
updatedAt: '2026-08-10T03:54:21.354Z'
completedAt: '2026-08-10T02:34:54.605Z'
timeSpent: 0
spec: specs/2026-08-10/desktop-server-sync
---
# [desktop-server-sync-02] Server Reconcile Batch Endpoint & Field-level Auto-Merge Engine

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement POST /api/v1/sync/reconcile-batch endpoint with mutation idempotency and server reconciliation engine for Field-level Auto-Merge on non-conflicting fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reconcile batch endpoint accepts mutation batches and repeated mutation identifiers are idempotent.
- [x] #2 Non-overlapping field changes from different clients are merged without losing either update.
- [x] #3 Server tests cover field-level merge and duplicate-batch behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Task @task-4p3rrx

### Overview
Xây dựng Reconcile Batch Endpoint (POST /api/v1/sync/reconcile-batch) và Server Reconciliation Engine thực hiện Field-level Auto-Merge dữ liệu từ các ứng dụng Desktop trên Server (apps/server).

### Locked Decision Alignment
- D1 (Conflict Strategy & Auto-Merge): Tự động hợp nhất (Field-level Auto-Merge) các trường dữ liệu không bị chồng lấn giữa các Client khác nhau. Trả về status: SYNCED cùng danh sách applied_fields.
- D2 (Sync Transport): Đảm bảo tính Idempotent cho API POST /api/v1/sync/reconcile-batch bằng mutation_id / idempotency_key.
- D3 (Client Identity): Đọc và sử dụng client_id, workspace_id, user_id từ SyncMutationItem để theo vết nguồn phát sinh dữ liệu.

### Steps
1. Định nghĩa Pydantic Schemas (apps/server/app/shared/schemas.py):
   - Thêm SyncMutationItem, SyncBatchRequest, SyncMutationAck, SyncBatchResponse.

2. Xây dựng Server Reconciliation Engine (apps/server/app/domain.py / apps/server/app/persistence.py):
   - Thêm bộ nhớ theo dõi thực thể (entity state store), lịch sử mutation events và idempotency cache.
   - Hàm reconcile_mutation_item(item: SyncMutationItem) thực hiện so sánh field_changes và tự động cập nhật dữ liệu nếu không bị xung đột cùng trường từ Client khác.

3. Tạo REST Router Endpoint (apps/server/app/modules/sync/router.py):
   - Khởi tạo router với đường dẫn POST /api/v1/sync/reconcile-batch.
   - Đăng ký sync_router trong apps/server/app/main_core/router_registry.py.

4. Unit & Integration Tests (apps/server/tests/test_sync_reconcile.py):
   - Test 1: Field-level Auto-Merge khi Client A sửa name và Client B sửa status trên cùng một thực thể -> Hợp nhất thành công.
   - Test 2: Gửi lại cùng một lô mutation (Idempotency check) -> Trả về IGNORED_DUPLICATE.

### Verification Plan
- Chạy pytest trong apps/server đảm bảo tất cả tests mới và tests hiện tại vượt qua 100%.
- Kiểm tra kết quả trả về của POST /api/v1/sync/reconcile-batch với payload JSON chuẩn từ Desktop Outbox.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented POST /api/v1/sync/reconcile-batch REST endpoint and ReconciliationEngine for Field-level Auto-Merge in apps/server. Added Pydantic schemas SyncMutationItem, SyncBatchRequest, SyncMutationAck, SyncBatchResponse, and tests in test_sync_reconcile.py. System Decision Impact: none — Implemented POST /api/v1/sync/reconcile-batch REST endpoint and ReconciliationEngine for Field-level Auto-Merge. Spec Decision Compliance: D1=pass, D2=pass, D3=pass.
Flow audit: implementation ACs added and verified against the completed reconcile endpoint and tests.
Fixes recorded: reconciliation resolution now preserves the server value when no client/custom choice is supplied and rejects unknown client choices; regression coverage added.
Review: PASS after server-value resolution regression fix. P1=0; field merge/idempotency behavior covered by the full server suite.
<!-- SECTION:NOTES:END -->

