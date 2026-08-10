---
id: xbtnje
title: "[desktop-server-sync-03] Server Conflict Detection, Staging Table & Reconciliation API"
status: done
priority: high
labels: []
createdAt: '2026-08-10T02:13:36.033Z'
updatedAt: '2026-08-10T03:34:24.676Z'
completedAt: '2026-08-10T02:45:49.857Z'
timeSpent: 0
spec: specs/2026-08-10/desktop-server-sync
---
# [desktop-server-sync-03] Server Conflict Detection, Staging Table & Reconciliation API

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement conflict detection for overlapping field mutations across client_ids, store in CONFLICT_PENDING staging table, and expose conflict resolution API endpoint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overlapping field mutations are staged with conflict status and client/workspace/user identity metadata.
- [x] #2 Conflict list/detail/resolve APIs support choosing a client version or custom values and update canonical state.
- [x] #3 Server tests cover conflict staging, listing and resolution.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Task @task-xbtnje

### Overview
Xây dựng Server Conflict Detection Engine, Staging Store lưu giữ bản ghi xung đột và hệ thống REST API quản lý & phê duyệt xung đột (/api/v1/sync/conflicts).

### Locked Decision Alignment
- D1 (Conflict Resolution Strategy): Server tự động phát hiện khi 2 Client sửa trùng một trường (field) trên cùng 1 thực thể. Lưu bản ghi vào trạng thái PENDING_REVIEW trong Staging Store, đồng thời cung cấp API phê duyệt cho phép Admin/User chọn giá trị từ Client nào hoặc áp dụng giá trị tùy chỉnh.
- D2 (Sync Status): Trả về trạng thái STAGED_FOR_REVIEW cho Replay Worker khi phát sinh xung đột trùng trường.
- D3 (Client Identity): Lưu vết client_id, workspace_id, user_id trong Staging Record để hỗ trợ giao diện so sánh side-by-side.

### Steps
1. Bổ sung Pydantic Schemas (apps/server/app/shared/schemas.py):
   - Thêm ConflictResolveRequest, StagedConflictResponse, StagedConflictListResponse.

2. Cập nhật Reconciliation Engine & Staging Store (apps/server/app/shared/reconciler.py):
   - Hoàn thiện cấu trúc StagedConflictRecord và hàm list_conflicts, get_conflict, resolve_conflict.
   - Khi resolve_conflict được gọi: áp dụng giá trị của chosen_client_id hoặc custom_values vào entity_states, cập nhật entity_field_timestamps và đánh dấu status = RESOLVED.

3. Thêm Conflict Resolution Endpoints (apps/server/app/modules/sync/router.py):
   - GET /api/v1/sync/conflicts: Liệt kê danh sách các xung đột chờ duyệt.
   - GET /api/v1/sync/conflicts/{conflict_id}: Xem chi tiết đối chiếu side-by-side của một xung đột.
   - POST /api/v1/sync/conflicts/{conflict_id}/resolve: Thực thi phê duyệt chọn phiên bản Client hoặc Custom merged value.

4. Integration Testing (apps/server/tests/test_sync_reconcile.py):
   - Test kịch bản xung đột cùng trường (Client A sampling_rate=50 vs Client B sampling_rate=200).
   - Test xem danh sách xung đột và phê duyệt chọn Client B -> Xác minh entity state được cập nhật chính xác.

### Verification Plan
- Chạy uv run --project apps/server pytest apps/server/tests đảm bảo 100% tests trong apps/server pass cleanly.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented conflict detection, Staging store (PENDING_REVIEW), and REST endpoints GET /api/v1/sync/conflicts and POST /api/v1/sync/conflicts/{conflict_id}/resolve. Added tests in test_sync_reconcile.py. System Decision Impact: none — Implemented conflict detection, PENDING_REVIEW staging table, and REST resolution API in apps/server. Spec Decision Compliance: D1=pass, D2=pass, D3=pass.
Flow audit: implementation ACs added and verified against the completed staging and resolution APIs.
<!-- SECTION:NOTES:END -->

