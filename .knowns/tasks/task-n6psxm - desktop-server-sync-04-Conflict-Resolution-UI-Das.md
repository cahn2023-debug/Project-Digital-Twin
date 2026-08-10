---
id: n6psxm
title: "[desktop-server-sync-04] Conflict Resolution UI Dashboard & End-to-End Verification"
status: done
priority: high
labels: []
createdAt: '2026-08-10T02:13:38.983Z'
updatedAt: '2026-08-10T03:54:27.105Z'
completedAt: '2026-08-10T02:51:17.245Z'
timeSpent: 0
spec: specs/2026-08-10/desktop-server-sync
---
# [desktop-server-sync-04] Conflict Resolution UI Dashboard & End-to-End Verification

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build side-by-side conflict resolution UI dashboard allowing Admin/User to inspect, select client version, and run end-to-end integration tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Conflict dashboard renders side-by-side server/client values and exposes client or custom resolution actions.
- [x] #2 Sync API helpers and dashboard are wired into the web/desktop sync management surface.
- [x] #3 End-to-end verification covers the sync acceptance criteria and the relevant desktop/server test suites.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Task @task-n6psxm

### Overview
Xây dựng giao diện Conflict Resolution UI Dashboard side-by-side cho phép người dùng/Admin đối chiếu, lựa chọn phiên bản Client hoặc Custom merged value, đồng thời thực hiện kiểm thử và xác minh SDD end-to-end cho Spec @doc/specs/2026-08-10/desktop-server-sync.

### Locked Decision Alignment
- D1 (Conflict Resolution UI): Hiển thị chi tiết so sánh side-by-side giữa Server fields và Client fields, cho phép Admin/User chọn phương án Chấp nhận Client A/B hoặc Tùy chỉnh.
- D2 (Hybrid Sync Status UI): Trực quan hóa trạng thái Outbox Queue và nút Đồng bộ ngay (Sync Now) trên giao diện.
- D3 (Client Identity Tracing): Giao diện hiển thị rõ thông tin client_id, workspace_id, user_id của nguồn gửi bản ghi.

### Steps
1. Tạo Frontend Sync API Client (apps/web/src/features/sync/api.ts & apps/desktop/src/features/sync.ts):
   - Thêm các hàm fetchStagedConflicts(), getConflictDetail(), resolveStagedConflict().

2. Xây dựng Conflict Resolution Dashboard UI (apps/web/src/features/sync/ConflictDashboard.tsx):
   - Render danh sách các bản ghi STAGED_FOR_REVIEW.
   - Render bảng so sánh side-by-side giữa Server Value vs Client Value.
   - Thao tác nút bấm Chọn Client Version hoặc nhập Custom Value và gửi API phê duyệt.

3. Tích hợp Conflict Dashboard vào Layout Web/Desktop:
   - Kết nối Conflict UI vào tab Audit / Sync Management của ứng dụng.

4. End-to-End SDD Verification (knowns validate --scope sdd):
   - Kiểm tra tất cả 5 tiêu chí Acceptance Criteria (AC-1 đến AC-5) của spec desktop-server-sync.md.
   - Đảm bảo tất cả unit tests của desktop-core và apps/server pass 100%.

### Verification Plan
- Chạy uv run --project apps/server pytest apps/server/tests đảm bảo backend server tests pass.
- Chạy cargo test -p desktop-core đảm bảo Rust desktop-core tests pass.
- Chạy knowns validate --scope sdd để xác minh 100% SDD coverage cho spec specs/2026-08-10/desktop-server-sync.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created Conflict Resolution Dashboard UI in apps/web/src/features/sync/ConflictDashboard.tsx and api helper in api.ts. Verified 100% tests in apps/server (54/54) and desktop-core (23/23). Verified SDD validation (0 errors). System Decision Impact: none — Implemented Conflict Resolution Dashboard UI and completed end-to-end SDD verification. Spec Decision Compliance: D1=pass, D2=pass, D3=pass.
Flow audit: implementation ACs added and verified against the completed dashboard and recorded verification.
Fixes recorded: ConflictDashboard is wired to the Datacenter Sync navigation entry; dashboard/API remains side-by-side and resolution-capable.
Review: PASS after Sync navigation wiring and full web build/typecheck. P1=0; one operational persistence P2 is tracked separately as task 0x820i.
<!-- SECTION:NOTES:END -->

