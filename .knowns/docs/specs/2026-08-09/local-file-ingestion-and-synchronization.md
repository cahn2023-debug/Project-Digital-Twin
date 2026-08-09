---
title: Local file ingestion and synchronization
description: Specification for local-first ingestion, mapping, versioning, audit and synchronization of messy Excel, Markdown-like, TXT and Word files.
createdAt: '2026-08-09T10:46:01.189Z'
updatedAt: '2026-08-09T11:26:45.477Z'
tags:
  - spec
  - approved
  - local-files
  - ingestion
  - sync
  - excel
  - documents
---

## Overview

Đặc tả cho khả năng đọc dữ liệu từ file local theo hướng local-first. Hệ thống đăng ký, version hóa, đọc và giữ nguyên dữ liệu nguồn; phát hiện cấu trúc lộn xộn; cho người dùng xác nhận mapping khi cần; tạo ChangeSet trước khi cập nhật canonical state; đồng bộ offline/online; và ghi audit toàn bộ vòng đời.

Phạm vi định dạng:

- Excel: quét các sheet visible, hỗ trợ nhiều bảng trong một sheet, header nhiều tầng, ô merge ngang/dọc, dòng tổng/ghi chú, công thức và Profile tái sử dụng.
- Markdown, TXT và Word: đọc theo cấu trúc Markdown/wiki, parsing toàn bộ nội dung, bảng, hình ảnh và file đính kèm. Không ghi thay đổi vào file gốc.
- Bảng trong Markdown/TXT/Word dùng chung flow mapping với Excel.

## Locked Decisions

- D1: Giai đoạn đầu hỗ trợ Excel có cấu trúc lộn xộn và ô merge; không giả định header ở dòng đầu tiên.
- D2: Tự quét các sheet visible để phát hiện dữ liệu; cấu trúc chưa từng nhận diện phải qua bước xác nhận.
- D3: Preview cho phép xác nhận mapping cột và lựa chọn trường nghiệp vụ như đối tượng, hạng mục, tọa độ GIS, nhà thầu và khách hàng.
- D4: Cột chưa mapping vẫn được giữ trong Raw; người dùng có thể mapping bổ sung và khai báo trường mới.
- D5: Ghi thêm cột vào Excel gốc chỉ sau xác nhận; phải tạo backup/version và audit note.
- D6: Giá trị merge ở header được lan truyền xuống các cột con để tạo header phân cấp.
- D7: Một sheet có thể có nhiều vùng/bảng độc lập; mỗi vùng có preview riêng.
- D8: Profile đã lưu được dùng để xác định header; cấu trúc mới phải cho người dùng chọn vùng header thủ công và được phép bỏ qua header không có giá trị trong data.
- D9: Profile cho phép đánh dấu mẫu dòng cần bỏ qua; preview cho phép xác nhận bỏ qua dòng tổng, ghi chú hoặc giữ ghi chú vào note.
- D10: Bỏ qua toàn bộ sheet hidden.
- D11: Merge theo chiều dọc trong data được lan truyền xuống các dòng con và giữ source row.
- D12: Mapping dùng giá trị đã tính của công thức; công thức gốc giữ trong Raw.
- D13: Có thể chọn một loại đối tượng cho mỗi bảng hoặc phân loại nhiều loại theo giá trị một cột.
- D14: Mỗi dòng tự sinh UUID; khi dữ liệu nhiều file có thể là cùng đối tượng, hệ thống gợi ý và yêu cầu xác nhận trước khi gắn chung UUID.
- D15: Mỗi field trong schema có UUID riêng, dùng ổn định giữa nhiều file.
- D16: Field mới được tự suy luận kiểu dữ liệu; người dùng xác nhận tên field.
- D17: Preview hỗ trợ tách/ghép cột và chuẩn hóa ngày, số, text; Profile hỗ trợ quy tắc biến đổi tùy ý.
- D18: Lỗi được đánh dấu theo dòng/field; người dùng có thể sửa, bỏ qua dòng hoặc import phần hợp lệ.
- D19: Gợi ý trùng đối tượng dựa trên loại, tên chuẩn hóa, ngữ cảnh cha/nhóm và vị trí; người dùng xác nhận gắn UUID.
- D20: Sau preview, hệ thống tạo ChangeSet, validate và chờ duyệt; dữ liệu chưa mapping vẫn được lưu Raw và thông báo.
- D21: Offline vẫn cập nhật local; Raw, ChangeSet và job sync được lưu bền vững; online trở lại sẽ sync và tạo conflict nếu cần.
- D22: Conflict hiển thị base/server/local theo từng field; field không xung đột tự giữ, field xung đột cần chọn hoặc sửa.
- D23: Cùng file_id, revision và SHA-256 đã xử lý thì không tạo import trùng, hiển thị unchanged/already imported.
- D24: Cùng đối tượng từ nhiều file được gộp nguồn; conflict theo field hiển thị file, sheet và dòng để người dùng chọn trước khi tạo ChangeSet.
- D25: Mỗi file tạo một ChangeSet riêng; file lỗi không chặn file hợp lệ.
- D26: Có manual scan và watcher trên thư mục đã đăng ký; file mới/thay đổi tự vào queue.
- D27: Watcher debounce; chỉ enqueue khi size/mtime ổn định, file đọc được và không bị khóa.
- D28: Lỗi tạm thời retry bằng backoff có giới hạn; lỗi cố định chuyển FAILED và thông báo.
- D29: Audit ghi toàn bộ vòng đời từ phát hiện file tới ghi ngược file.
- D30: Profile/mapping chỉnh sửa sẽ tạo version bất biến mới; version cũ được giữ để tái hiện.
- D31: File version tạo ngay khi hash/metadata xác nhận nội dung thay đổi; cùng hash không tạo version mới.
- D32: Restore tạo write job/ChangeSet mới, giữ lịch sử và backup trước khi ghi.
- D33: Sau sync thành công local chỉ giữ version mới nhất; lịch sử đầy đủ lưu server.
- D34: Thay đổi do chính phần mềm ghi ra được audit/version hóa nhưng không tạo import trùng.
- D35: Audit lưu actor, thời gian, loại thao tác, liên kết file/Profile/ChangeSet và before/after theo field.
- D36: Audit append-only; không sửa/xóa trực tiếp.
- D37: Có màn hình tra cứu và xuất audit theo Project, file, object, actor, thời gian, Profile, ChangeSet và trạng thái.
- D38: Audit event có event_id, correlation_id, causation_id và liên kết xuyên suốt các bước.
- D39: Quyền xem audit, xuất audit, duyệt ChangeSet và restore file là các quyền riêng trong Project.
- D40: Nghiệm thu dùng fixture đại diện và file Excel thực tế của Project.
- D41: Chưa đặt ngưỡng hiệu năng cố định; phải đo và theo dõi thời gian xử lý.
- D42: Write-back phải hash-check, backup, giữ nội dung không quản lý, atomic replace, audit/version và từ chối stale/locked file.
- D43: Nghiệm thu offline gồm queue sau restart, retry idempotent, sync online, không import trùng và conflict theo field.
- D44: Nghiệm thu audit gồm lifecycle events, append-only, correlation chain, before/after, filter/export và Project permissions.
- D45: Mọi dòng/ô nguồn phải truy vết được qua Raw và source locator file/version/sheet/row/column; mapped, unmapped và invalid phải rõ ràng.
- D46: File có Profile phù hợp chạy tự động; cấu trúc mới phải preview, lưu Profile version mới và lần sau tự dùng lại.
- D47: Markdown, TXT và Word được đọc/parsing theo cấu trúc Markdown/wiki; bảng dùng flow mapping như Excel; file gốc không ghi ngược.
- D48: Nội dung wiki có thể dùng các cấu trúc tương tự Markdown như heading, section và liên kết.
- D49: Word parsing toàn bộ nội dung gồm heading, đoạn văn, danh sách, link, metadata, bảng, hình ảnh và file đính kèm.
- D50: Entity reference ưu tiên UUID/mã; nếu thiếu dùng loại, tên chuẩn hóa và ngữ cảnh; mơ hồ phải xác nhận.
- D51: Hình ảnh và file đính kèm là source asset riêng, có hash/version và liên kết tới file/vị trí nguồn.
- D52: Quan hệ suy luận từ wiki/Word tạo đề xuất trong ChangeSet, có nguồn dẫn chứng và chờ xác nhận trước canonical.

## System Decision Impact

- Impact: existing.
- Governing decisions: ADR-002 Managed File Authority, ADR-003 ChangeSet Model, ADR-005 Synchronization and Concurrency, ADR-006 Transactional Event Outbox, ADR-007 Geometry Conflicts, ADR-008 Storage and Retention.
- Acceptance gate: implementation must preserve immutable file identity/version, explicit ChangeSet lifecycle, local-first queue behavior, conflict evidence, event auditability and retention semantics.

## Requirements

### Functional Requirements

- FR-1: Register each source file with logical file identity, physical location, file role, Profile reference, current hash, size, metadata and immutable file version.
- FR-2: Support manual scan and watcher scan for registered directories. Ignore hidden sheets, debounce file events and queue only stable readable unlocked files.
- FR-3: For Excel, discover multiple data regions across visible sheets, including multiple tables per sheet and multi-row headers.
- FR-4: Expand horizontal and vertical merged cells while retaining original source coordinates and source row information.
- FR-5: Use saved Profiles automatically. For unknown structures, show preview, let the user choose header/table regions and save a new immutable Profile version.
- FR-6: Allow mapping standard fields, object type, work-item groups, GIS coordinates, contractor, customer and custom schema fields. Assign stable UUIDs to schema fields.
- FR-7: Support one object type per table and multi-type classification from a source column.
- FR-8: Generate row UUIDs and propose cross-file identity matches using object type, normalized name, parent/group context and location. Require confirmation for ambiguous matches.
- FR-9: Preserve all source content in Raw, including unmapped/invalid values, formulas, source locators and source file version.
- FR-10: Support basic transformations in preview and reusable custom transformation rules in Profiles.
- FR-11: Show row/field validation errors and allow correction, row skip or partial valid import.
- FR-12: Create one ChangeSet per file after preview confirmation. Validate and wait for approval before applying canonical state.
- FR-13: Support local-first processing. Persist local Raw, ChangeSets and pending sync jobs across restart; sync when online with idempotency.
- FR-14: Detect unchanged file versions and already-processed imports without creating duplicate changes.
- FR-15: Merge same-object data from multiple files and show field conflicts with file/sheet/row evidence before ChangeSet creation.
- FR-16: Watcher must identify self-generated write-back changes and suppress duplicate re-import.
- FR-17: Allow Excel write-back only after user confirmation. Add new fields/columns, preserve unmanaged content, create backup, validate and atomically replace.
- FR-18: Allow restore of an old local file version through a new write job/ChangeSet; never mutate historical versions.
- FR-19: Parse Markdown, TXT and Word into Markdown-like sections, paragraphs, lists, links, metadata, tables, images and attachments. Do not modify these originals.
- FR-20: Register images and attachments as versioned source assets linked to the source file and content location.
- FR-21: Extract object references from narrative content and propose relationships in a ChangeSet with source evidence; require confirmation before canonical apply.
- FR-22: Record append-only audit events for the complete lifecycle with actor, time, action, before/after field values, source links and event correlation.
- FR-23: Provide Project-scoped audit search/export and independent permissions for audit view, export, ChangeSet approval and file restore.
- FR-24: After successful sync, retain only the latest local file version while preserving the full history on server.

### Non-Functional Requirements

- NFR-1: No source information may disappear without an explicit, visible result as mapped, unmapped, invalid, skipped or Raw.
- NFR-2: All source-to-domain data must be traceable by file, immutable version, sheet, row and column where applicable.
- NFR-3: File writes must be reversible and safe against stale hashes, locks, partial replacements and unmanaged content changes.
- NFR-4: The system must expose processing duration and queue/retry/conflict status; fixed performance thresholds are deferred until baseline measurements exist.
- NFR-5: Historical Profiles, file versions, ChangeSets and audit events must remain reproducible/append-only according to the governing ADRs.
- NFR-6: All canonical mutations must follow the existing Project authorization boundary and ChangeSet lifecycle.

## Acceptance Criteria

- [ ] AC-1: A fixture workbook with visible/hidden sheets, multiple tables, merged multi-level headers, vertical merged data, notes, totals and formulas is scanned; hidden sheets are skipped and every source cell has Raw/source locator coverage.
- [ ] AC-2: A workbook with a saved Profile is processed without asking for header/mapping confirmation.
- [ ] AC-3: An unknown workbook presents detected regions and header candidates; the user can choose headers, ignore unused headers, confirm mappings and save a new Profile version.
- [ ] AC-4: Header merge values and vertical data merge values are propagated correctly while original sheet/row/column references remain available.
- [ ] AC-5: Rows with totals, notes and repeated headers are handled according to confirmed skip patterns; notes can be retained as note.
- [ ] AC-6: Mapping supports one object type per table and multi-type classification; new fields receive schema UUIDs and inferred types after user name confirmation.
- [ ] AC-7: Basic transformations and a Profile-defined custom transformation produce expected mapped values.
- [ ] AC-8: Invalid/missing values are highlighted per field; the user can correct, skip rows or import only valid rows without losing Raw.
- [ ] AC-9: Same-object candidates across files show matching evidence; ambiguous candidates require confirmation and confirmed matches reuse the same row UUID.
- [ ] AC-10: Import creates one ChangeSet per file, leaves canonical state unchanged before approval, and preserves unmapped data in Raw with a user-visible notice.
- [ ] AC-11: Offline import survives application restart, queues work, retries idempotently and syncs after reconnect.
- [ ] AC-12: A stale or duplicate file version does not create a duplicate import; unchanged/already imported status is visible.
- [ ] AC-13: Cross-file field conflicts show base/server/local or source-file/sheet/row evidence; non-conflicting fields are retained automatically and conflicting fields require user resolution.
- [ ] AC-14: Watcher and manual scan both enqueue stable files; rapid writes are debounced; locked/unreadable files retry with backoff and eventually become FAILED with notification.
- [ ] AC-15: Excel write-back verifies expected hash, creates backup, preserves unmanaged sheets/columns/content, validates the replacement, atomically replaces the source and updates version/audit.
- [ ] AC-16: A stale or locked Excel file is not modified. Restore creates a new write job/ChangeSet, backup and audit entry.
- [ ] AC-17: Markdown/TXT/Word parsing extracts text structure, tables, images and attachments without modifying originals; assets receive hash/version/source links.
- [ ] AC-18: Narrative references resolve by UUID/code first, then normalized object/context; ambiguous references become reviewable relationship proposals.
- [ ] AC-19: Audit contains all lifecycle events, event/correlation/causation IDs and field-level before/after values; direct edit/delete is rejected.
- [ ] AC-20: Project-scoped audit UI filters and exports by all required dimensions; permission checks distinguish view, export, approval and restore.
- [ ] AC-21: After successful sync, local cleanup retains the latest version while server history remains queryable and reproducible.
- [ ] AC-22: The suite passes on representative fixtures plus selected real Project files, and processing duration is recorded for each file.

## Scenarios

### Scenario 1: Known Excel Profile

Given a registered visible workbook whose hash differs from the last known version and whose structure matches a saved Profile
When the watcher completes debounce and the worker reads the file
Then a new immutable file version is registered, mapping runs automatically, Raw and source locators are stored, and one file-specific ChangeSet is created without duplicate import.

### Scenario 2: Unknown messy workbook

Given a workbook with multiple visible sheets, multiple tables, merged headers, merged data cells, notes and totals with no matching Profile
When the user opens the preview
Then the system shows candidate regions/headers, allows manual header selection and skip rules, shows mapping/validation results, and saves a new Profile version after confirmation.

### Scenario 3: Unmapped field and safe write-back

Given a source column that is not in the schema
When the user confirms it as a new field
Then the original value remains in Raw, the field receives a schema UUID and inferred type, and a confirmed write job adds the managed column to the original Excel with backup, atomic replacement and audit.

### Scenario 4: Document knowledge and relationship proposal

Given a Word or Markdown-like document containing headings, object references, a table, an image and an attachment
When the document is parsed
Then table data follows the Excel mapping flow, assets are registered with hash/version, references resolve by UUID/code or normalized context, and proposed relationships remain in a ChangeSet until confirmed.

### Scenario 5: Offline import and conflict

Given a local file is imported while the server is unavailable
When the application restarts and later reconnects to a server with a changed field
Then the local queue survives, retry is idempotent, non-conflicting fields are retained and the conflicting field displays base/server/local values for resolution.

### Scenario 6: External edit versus self write-back

Given a file version is registered
When an external edit changes its hash before write-back, or the application itself writes a new version
Then an external stale write is rejected without modification, while a self-generated change is audited/versioned without producing a duplicate import.

### Scenario 7: Audit and restore

Given an authorized user searches a Project audit
When they filter by file, object, actor, Profile or ChangeSet and choose a prior file version for restore
Then the system shows the full correlated lifecycle and creates a new audited restore job without changing historical records.

## Technical Notes

- Reuse the existing server Camera workbook profile/importer as the first domain adapter, but move local file discovery, versioning, queue execution and document parsing behind explicit desktop/worker boundaries.
- Preserve the existing local manifest concepts: local_files, file_hash_cache, sync_state, pending_jobs and cached_entities.
- Treat Raw, source assets, file versions, Profiles, ChangeSets and audit events as distinct records with explicit retention classification.
- Keep document originals read-only. Excel write-back is limited to confirmed managed additions/restores and must respect ADR-002.
- The parser/profile engine should expose source locators and deterministic input/output metadata so a historical import can be reproduced.
- Custom Profile transformation rules require a constrained, reviewable execution model; arbitrary unsafe code execution is out of scope.
- Performance targets remain open until representative fixture and Project-file measurements are collected.

## Task Links

- @task-qzkm2k [local-file-ingestion-01] Establish local file registry, versions, Raw and source locators
- @task-own4rr [local-file-ingestion-02] Implement Excel discovery, merge normalization and Profiles
- @task-epi5h5 [local-file-ingestion-03] Implement schema mapping, transformations, identity and validation
- @task-trbw1k [local-file-ingestion-04] Implement desktop watcher, SQLite queue and offline sync
- @task-1feoxs [local-file-ingestion-05] Implement ChangeSet import, approval and conflict resolution
- @task-5h1gqr [local-file-ingestion-06] Implement Excel write-back, restore and self-write detection
- @task-tgowk5 [local-file-ingestion-07] Implement Markdown, TXT and Word parsing, assets and relations
- @task-c6dq6m [local-file-ingestion-08] Implement audit UI, permissions, retention and end-to-end verification

## Open Questions

- [ ] Exact Excel extensions and behavior for xlsx, xlsm, xls, protected/password-protected workbooks.
- [ ] Exact Word formats and library support, including docx versus legacy doc.
- [ ] The formal name/grammar of the “LLW wiki” convention beyond Markdown-like structure.
- [ ] Supported GIS coordinate reference systems and coordinate precision policy.
- [ ] Server storage/retention implementation details for Raw, assets and full audit history.
- [ ] Configuration and sandbox policy for custom Profile transformation rules.
- [ ] Performance baselines from representative fixtures and real Project files.
