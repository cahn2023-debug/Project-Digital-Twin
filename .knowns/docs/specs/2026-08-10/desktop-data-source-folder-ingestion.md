---
title: Desktop data source folder ingestion
description: Specification for adding desktop data sources by selecting folders, parsing files, and persisting ingestion results locally before synchronization.
createdAt: '2026-08-10T01:46:40.970Z'
updatedAt: '2026-08-10T12:45:51.202Z'
tags:
  - spec
  - desktop
  - data-source
  - ingestion
  - draft
  - review-required
---

## Overview

Hoàn thiện end-to-end luồng **Thêm nguồn dữ liệu** trong desktop app: người dùng chọn thư mục gốc, đăng ký thư mục cho Project, quét đệ quy, parsing và preview/mapping các file Excel/XLSX, CSV, TXT, Markdown, Word .doc và .docx, lưu Raw/ChangeSet/audit vào database local mã hóa, rồi đồng bộ lên server qua outbox khi có mạng.

Feature nối UI desktop với scanner/watcher, parser local, preview/mapping, local-first persistence, ChangeSet review, rollback và server sync. File nguồn luôn được giữ nguyên; cảnh báo favicon.ico 404 trong Vite dev là vấn đề asset tĩnh riêng, không thuộc pipeline parsing.

## Locked Decisions

- D1: Phạm vi bao gồm chọn thư mục trên desktop, quét file, parsing, lưu database và áp dụng các contract ingestion hiện có; không tách parsing/database thành hạng mục sau.
- D2: Thư mục nguồn được quét đệ quy; chỉ nhận .xlsx, .xlsm, .xls, .csv, .md, .markdown, .txt, .doc và .docx; bỏ qua file ẩn, file tạm và extension ngoài danh sách.
- D3: File khớp Profile được parsing tự động; file mới hoặc không khớp phải qua preview/mapping và xác nhận trước khi tạo ChangeSet/ghi canonical state.
- D4: Parsing ghi vào database local mã hóa trước; Raw, ChangeSet, audit và pending sync job được lưu bền vững tại desktop rồi mới đồng bộ lên server.
- D5: Thư mục được đăng ký như nguồn dữ liệu lâu dài, hỗ trợ quét thủ công và watcher tự phát hiện file mới/thay đổi.
- D6: Batch import xử lý độc lập theo file; file hợp lệ vẫn tiếp tục. Trong từng file, dòng hợp lệ có thể import một phần; lỗi hiển thị theo file/dòng/field.
- D7: Một Project có thể đăng ký nhiều thư mục nguồn; mỗi thư mục là một source riêng và có watcher độc lập.
- D8: Word .doc và .docx đều nằm trong phạm vi hỗ trợ đầy đủ; không chuyển .doc thành unsupported mặc định.
- D9: Mọi thành viên có quyền truy cập Project được đăng ký source và xác nhận preview/ChangeSet.
- D10: Khi gỡ source, hệ thống dừng watcher, đánh dấu source archived và giữ file registry/Raw/ChangeSet/audit lịch sử.
- D11: File chưa có Profile hoặc parser không tự nhận diện được phải đi qua preview/mapping trên desktop trước; raw fallback chỉ là nhánh dự phòng sau đó khi kết quả vẫn không thể xử lý.
- D12: Field không mapping được, sai kiểu hoặc bị bỏ qua vẫn được giữ trong Raw/unmapped; phần hợp lệ được import một phần và cảnh báo phải hiển thị rõ.
- D13: Giá trị ngày/số/boolean đủ rõ được chuẩn hóa theo locale/cấu hình Project nhưng luôn giữ giá trị gốc; giá trị mơ hồ không tự đoán, tạo warning và chờ xác nhận.
- D14: Conflict giữa dữ liệu local và canonical state trên server được giữ ở trạng thái conflict review; không tự động ưu tiên hoặc ghi đè bên nào.
- D15: CSV tự nhận diện UTF-8/BOM, delimiter và header; trường hợp mơ hồ phải mở preview/mapping.
- D16: Hình ảnh và file đính kèm từ Markdown/Word được lưu local với hash/version/source locator và đưa vào queue sync cùng ChangeSet.
- D17: Watcher tự bật sau khi source được đăng ký; người dùng vẫn có thể tạm dừng hoặc bật lại.
- D18: Scan/parse chạy nền, hiển thị tiến độ theo source/file và cho phép hủy tác vụ đang chờ mà không chặn UI chính.
- D19: Cùng một đường dẫn đã chuẩn hóa trong một Project chỉ tạo một source; đăng ký lại sẽ mở source hiện có.
- D20: File không đọc được do quyền hệ điều hành hoặc đang bị khóa không được upload; lỗi được ghi theo file, giữ retry/outbox và không chặn file khác.
- D21: Khóa mã hóa database/Raw/ChangeSet local được quản lý bởi OS keychain/credential store của desktop.
- D22: Raw local được giữ đến khi người dùng chủ động xóa/archive source; chỉ file tạm được dọn tự động.
- D23: Audit log append-only cho scan, parse, mapping, import, retry và sync; mỗi event có user, thời gian, source/file/hash, kết quả và correlation ID.
- D24: Mỗi revision file tạo version/ChangeSet mới, giữ lịch sử đầy đủ và cho phép rollback bản đã xác nhận qua ChangeSet.
- D25: Mỗi revision được parse lại toàn bộ để deterministic; hệ thống tạo diff theo version/source locator thay vì chỉ cập nhật phần thay đổi.
- D26: Mọi ChangeSet, kể cả file khớp Profile, phải được người dùng xác nhận trước khi áp dụng vào canonical state.
- D27: Record không có ID ổn định dùng identity deterministic từ Project/source/file revision/hash/locator; nếu có cột khóa thì ưu tiên cột đó.
- D28: Field mới hoặc mất field giữa các revision được giữ trong unmapped, cảnh báo và đưa qua preview/mapping; Profile không tự bị sửa.
- D29: Preview hiển thị vùng dữ liệu, header, mẫu dòng, kiểu dữ liệu và lỗi theo field; người dùng được map, đổi kiểu, bỏ qua dòng và lưu Profile version mới.
- D30: Review trước khi apply hiển thị diff trước/sau, record hợp lệ, unmapped/invalid, warning, asset và source locator; phải có xác nhận rõ ràng.
- D31: Người dùng được sửa giá trị normalized trong ChangeSet nhưng không sửa file nguồn; mọi chỉnh sửa phải ghi audit.

## System Decision Impact

- Impact: existing
- Decision: Tái sử dụng contract trong @doc/specs/2026-08-09/local-file-ingestion-and-synchronization, mô hình local-first trong @doc/specs/2026-08-10/offline-desktop-server-sync và các contract parse-before-upload tại @doc/specs/2026-08-10/desktop-parse-before-server-upload; không tạo System Decision mới.
- Acceptance gate: xác nhận các acceptance criteria của spec này, gồm parser formats, preview/mapping, persistence local mã hóa bằng OS keychain, queue sau restart, import idempotent, audit append-only, rollback và đồng bộ khi online. Các quyết định hệ thống draft liên quan chỉ được accept sau khi implementation/verification đạt gate.

## Requirements

### Functional Requirements

- FR-1: UI desktop cung cấp thao tác “Thêm nguồn dữ liệu”, mở folder picker native và từ chối đường dẫn không tồn tại hoặc không phải thư mục.
- FR-2: Khi xác nhận thư mục, hệ thống tạo source registration gắn với Project, lưu đường dẫn đã chuẩn hóa, trạng thái hoạt động, thời điểm đăng ký và cấu hình watcher; đăng ký lại cùng đường dẫn phải mở source hiện có.
- FR-3: Manual scan và watcher quét đệ quy từng source registration; chỉ nhận .xlsx, .xlsm, .xls, .csv, .md, .markdown, .txt, .doc và .docx; bỏ qua file ẩn/temp và file ngoài danh sách.
- FR-4: Scanner tính SHA-256, size, mtime và tạo file identity/version bất biến; chỉ enqueue file sau khi file ổn định, đọc được và không bị khóa.
- FR-5: File khớp Profile version đang hoạt động được parser local xử lý tự động, tạo Raw/source locator, normalized records, mapping result và một ChangeSet file-specific.
- FR-6: File chưa có Profile, cấu trúc không khớp hoặc parser không nhận diện được phải mở preview/mapping trên desktop trước; sau khi không thể xử lý tiếp mới được dùng raw fallback.
- FR-7: Excel phải hỗ trợ sheet visible, nhiều vùng/bảng, header nhiều dòng, ô merge ngang/dọc, công thức dùng giá trị đã tính và giữ công thức/raw cùng locator sheet/row/column.
- FR-8: CSV phải tự nhận diện UTF-8/BOM, delimiter và header; khi kết quả không chắc chắn phải hiển thị preview để người dùng xác nhận.
- FR-9: Markdown/TXT/Word .doc và .docx phải parse cấu trúc Markdown-like gồm heading/section, đoạn văn, danh sách, link, metadata, bảng, hình ảnh và attachment; asset/reference proposal phải liên kết với file version.
- FR-10: Mỗi record/field được gán identity deterministic theo Project/source/file revision/hash/locator; cột khóa ổn định nếu có được ưu tiên và parse lại không tạo UUID mới cho cùng record.
- FR-11: Field mapped, unmapped, invalid và skipped đều được giữ trong Raw cùng source file/version và source locator; phần hợp lệ có thể tạo import một phần.
- FR-12: Preview phải hiển thị vùng dữ liệu, header, mẫu dòng, kiểu dữ liệu, mapping và lỗi theo field; người dùng có thể map, đổi kiểu, bỏ qua dòng và lưu Profile version mới.
- FR-13: Sau preview confirmation, hệ thống tạo đúng một ChangeSet cho mỗi file, validate và giữ trạng thái chờ approval trước khi áp dụng canonical state.
- FR-14: Người dùng có thể sửa giá trị normalized trong ChangeSet nhưng không sửa file nguồn; chỉnh sửa phải tạo audit event.
- FR-15: Giá trị ngày/số/boolean đủ rõ được chuẩn hóa theo locale/cấu hình Project nhưng giữ giá trị gốc; giá trị mơ hồ tạo warning và không được tự đoán.
- FR-16: Sau mỗi revision, parser chạy lại toàn bộ file để deterministic, tạo diff theo version/source locator, giữ lịch sử và hỗ trợ rollback ChangeSet đã xác nhận.
- FR-17: Hình ảnh và file đính kèm được lưu local với hash/version/source locator và đưa vào queue sync cùng ChangeSet.
- FR-18: Raw, ChangeSet, file registry/version, audit và pending sync job được ghi transactionally vào database local mã hóa; khóa mã hóa do OS keychain/credential store quản lý.
- FR-19: File có cùng file identity, revision và SHA-256 đã xử lý không tạo import/ChangeSet trùng; thay đổi do write-back được audit/version hóa nhưng không enqueue import trùng.
- FR-20: Watcher tự bật sau đăng ký, chạy độc lập theo source, debounce thay đổi và chỉ enqueue khi size/mtime/hash ổn định; source archive phải dừng watcher nhưng giữ lịch sử.
- FR-21: Scan/parse/import chạy nền, hiển thị tiến độ theo source/file, cho phép hủy tác vụ đang chờ và không chặn UI chính.
- FR-22: Lỗi scan/parser/import/quyền file/file bị khóa được ghi nhận theo source/file/row/field; file khác vẫn được xử lý và file chưa đọc được không được upload.
- FR-23: Audit log append-only cho scan, parse, mapping, import, retry và sync; event phải chứa user, timestamp, source/file/hash, kết quả và correlation ID.
- FR-24: Khi online, pending sync jobs gửi theo thứ tự và idempotency key; lỗi mạng retry có giới hạn, conflict được giữ để người dùng review, không tự ưu tiên local/server.
- FR-25: Raw local được giữ đến khi người dùng chủ động xóa/archive source; chỉ file tạm được dọn tự động.
- FR-26: UI hiển thị trạng thái source, số file phát hiện, queued, lỗi, tiến độ, trạng thái sync và review diff trước/sau cùng Raw/unmapped/invalid/asset/source locator.

### Non-Functional Requirements

- NFR-1: Không ghi dữ liệu canonical trước khi preview/mapping và ChangeSet được người dùng xác nhận.
- NFR-2: Database local, Raw, ChangeSet, audit và queue dùng boundary persistence mã hóa hiện có của desktop; không dùng browser local storage làm nơi lưu dữ liệu nghiệp vụ.
- NFR-3: Mọi bản ghi import và asset phải truy vết được tới Project, source registration, file version, hash, locator, Profile và audit correlation.
- NFR-4: Thao tác scan/import không làm treo UI; progress/cancel/status phải được cập nhật nhất quán.
- NFR-5: Parser/scanner xử lý Unicode path/nội dung, không làm mất dữ liệu unmanaged và không sửa file gốc trong luồng ingestion.
- NFR-6: Tests phải bao phủ Excel merged/multi-table/formula, CSV encoding/delimiter/header, Markdown/TXT/Word .doc/.docx với bảng/asset, file lỗi/locked, duplicate identity, schema drift, restart offline, watcher nhiều source, conflict và rollback.
- NFR-7: Audit là append-only và Raw lịch sử không bị dọn tự động ngoài file tạm; dữ liệu local được bảo vệ bằng OS keychain.

## Acceptance Criteria

- [ ] AC-1: Người dùng chọn được thư mục bằng native folder picker, đăng ký thành công source với Project và nhìn thấy source trong danh sách; có thể đăng ký source thứ hai mà source thứ nhất vẫn hoạt động.
- [ ] AC-2: Manual scan quét đệ quy thư mục, nhận đúng các extension hỗ trợ gồm CSV và Word .doc/.docx, bỏ qua file ẩn/temp và hiển thị tổng số file phát hiện cùng lỗi scan nếu có.
- [ ] AC-3: File ổn định tạo được file identity/version có SHA-256, size, mtime và được enqueue một lần; file đang bị khóa, thiếu quyền hoặc thay đổi liên tục không được import như file hoàn chỉnh.
- [ ] AC-4: File khớp Profile được parsing tự động; Raw, source locator, identity deterministic và một ChangeSet theo file được lưu vào local DB mã hóa mà không cần mapping lại.
- [ ] AC-5: File cấu trúc mới mở preview có candidate region/header, mẫu dòng, kiểu dữ liệu, mapping, validation issues và cho phép lưu Profile mới; chưa có canonical apply trước khi người dùng xác nhận.
- [ ] AC-6: Fixture Excel có sheet hidden, merged header/data, nhiều vùng bảng và công thức được parse đúng; giá trị tính được dùng cho mapping, công thức và locator vẫn còn trong Raw.
- [ ] AC-7: Fixture CSV có BOM/encoding, delimiter hoặc header khác nhau được nhận diện; trường hợp mơ hồ mở preview/mapping thay vì tự đoán.
- [ ] AC-8: Fixture Markdown/TXT/Word .doc/.docx có heading, bảng, link, hình ảnh/attachment và reference được parse; asset có hash/version/locator và proposal chờ xác nhận.
- [ ] AC-9: Khi batch có file lỗi hoặc dòng lỗi, file/dòng hợp lệ vẫn được lưu; UI hiển thị lỗi theo source/file/row/field và không làm mất Raw của unmapped/invalid/skipped.
- [ ] AC-10: Ngày/số/boolean rõ ràng được chuẩn hóa theo locale/cấu hình nhưng giữ giá trị gốc; giá trị mơ hồ tạo warning và chờ xác nhận.
- [ ] AC-11: Sau khi đóng/mở lại app ở trạng thái offline, source registrations, Raw, ChangeSet, audit và pending sync jobs vẫn còn; khi online queue retry idempotently và conflict được giữ để review.
- [ ] AC-12: Quét lại file không đổi hoặc phát hiện self-write không tạo duplicate import/ChangeSet; thay đổi file thật tạo revision mới, parse lại toàn bộ và tạo diff/rollback history.
- [ ] AC-13: Cùng một đường dẫn đã chuẩn hóa trong một Project không tạo source thứ hai; source bị gỡ dừng watcher nhưng giữ lịch sử archive.
- [ ] AC-14: Watcher tự bật sau đăng ký, chạy độc lập giữa nhiều source, debounce đúng và cập nhật progress; tác vụ đang chờ có thể hủy mà không làm dừng source khác.
- [ ] AC-15: Review ChangeSet hiển thị diff trước/sau, record hợp lệ, unmapped/invalid, warning, asset và source locator; người dùng có thể sửa normalized value, xác nhận hoặc từ chối, và mọi sửa đổi xuất hiện trong audit.
- [ ] AC-16: Audit append-only ghi đủ scan/parse/mapping/import/retry/sync với user, thời gian, source/file/hash, kết quả và correlation ID; Raw chỉ bị xóa khi người dùng chủ động xóa/archive source.
- [ ] AC-17: Khóa mã hóa local được lấy từ OS keychain/credential store; dữ liệu nghiệp vụ không được lưu trong browser local storage.
- [ ] AC-18: Typecheck/build/test liên quan của desktop, desktop-core, web và server pass; SDD validation và git diff --check pass.

## Scenarios

### Scenario 1: Thêm source và quét thư mục

**Given** người dùng đang ở một Project và có thư mục dữ liệu gốc chứa nhiều thư mục con

**When** người dùng chọn “Thêm nguồn dữ liệu” và xác nhận thư mục

**Then** source được đăng ký, watcher tự bật, scanner quét đệ quy các file hỗ trợ, ghi manifest/hash và hiển thị kết quả theo file; nếu đường dẫn đã đăng ký thì mở source hiện có thay vì tạo bản ghi trùng.

### Scenario 2: File khớp Profile

**Given** source có workbook hoặc CSV khớp Profile đã lưu và hash khác revision gần nhất

**When** manual scan hoặc watcher kết thúc debounce

**Then** file version mới được đăng ký, parser local chạy toàn bộ file, identity deterministic/source locator/Raw và một ChangeSet file-specific được lưu local ở trạng thái chờ người dùng review.

### Scenario 3: File cấu trúc mới

**Given** workbook có merged header, nhiều vùng bảng hoặc file có schema mới và không khớp Profile

**When** worker đưa file vào preview

**Then** UI hiển thị vùng/header/mẫu dòng/kiểu dữ liệu/mapping/validation, người dùng có thể map, đổi kiểu, bỏ qua dòng, lưu Profile version mới và xác nhận ChangeSet trước canonical apply.

### Scenario 4: CSV, Document và asset

**Given** CSV có BOM/delimiter không mặc định hoặc Word .doc/.docx/Markdown-like document có heading, reference, bảng, hình ảnh và attachment

**When** parser xử lý file

**Then** hệ thống tự nhận diện phần rõ ràng, đưa phần mơ hồ vào preview, lưu nội dung/bảng/asset/locator/relationship proposal vào Raw/ChangeSet; asset có hash/version và được queue sync, file gốc không bị sửa.

### Scenario 5: Batch có lỗi một phần

**Given** source có một file bị khóa hoặc thiếu quyền, một workbook có dòng sai kiểu và các file hợp lệ khác

**When** người dùng chạy scan/import

**Then** file không đọc được chuyển trạng thái lỗi và giữ retry/outbox nhưng không upload; dòng sai được giữ Raw/unmapped và đánh dấu theo field; file/dòng hợp lệ vẫn được lưu và UI hiển thị kết quả từng mục.

### Scenario 6: Offline restart và đồng bộ

**Given** desktop đang offline khi file được import

**When** app restart rồi kết nối mạng trở lại

**Then** source/Raw/ChangeSet/audit/pending job được khôi phục từ local DB mã hóa, queue gửi theo idempotency key, retry không tạo duplicate và conflict được giữ để người dùng review.

### Scenario 7: File unchanged, self-write và revision

**Given** file đã import hoặc vừa được app ghi write-back

**When** watcher phát hiện lại file

**Then** hash/idempotency/self-write provenance ngăn import trùng; nếu nội dung thay đổi thật thì parser chạy lại toàn bộ, tạo file revision/diff/ChangeSet mới, giữ lịch sử và cho phép rollback bản đã xác nhận.

### Scenario 8: Review và chỉnh sửa ChangeSet

**Given** ChangeSet có normalized records, unmapped/invalid, warning và asset

**When** người dùng mở màn hình review

**Then** UI hiển thị diff trước/sau cùng source locator, cho sửa normalized value nhưng không sửa file nguồn, yêu cầu xác nhận rõ ràng trước canonical apply và ghi mọi chỉnh sửa vào audit append-only.

### Scenario 9: Archive source

**Given** người dùng gỡ source khỏi Project

**When** thao tác archive được xác nhận

**Then** watcher dừng, source chuyển archived, Raw/registry/ChangeSet/audit lịch sử và asset local vẫn còn; chỉ file tạm được dọn tự động.

## Technical Notes

- Desktop entry points hiện có: apps/desktop/src/features/local-files.ts, apps/web/src/features/datacenter/sourceApi.ts, apps/web/src/features/datacenter/importWorker.ts và Tauri commands trong apps/desktop/src-tauri/src.
- Scanner/manifest hiện có: crates/desktop-core/src/scanner.rs và crates/desktop-core/src/manifest.rs; parser boundary hiện có tại crates/desktop-core/src/parser.rs và apps/desktop/src-tauri/src/parse_cmd.rs.
- Server-side parsing contracts hiện có tại apps/server/app/adapters/files/importers/excel.py, apps/server/app/adapters/files/importers/documents.py, apps/server/app/shared/contracts.py, apps/server/app/shared/schemas.py và domain import/ChangeSet.
- Implementation phải bổ sung/hoàn thiện parser .doc bên cạnh .docx, CSV autodetection, deterministic record identity, preview/mapping editing, normalized-value audit, full-revision diff/rollback và OS keychain boundary theo các Locked Decisions.
- Các key hiện tại chỉ theo row/file-version hoặc identity UUID tạm thời phải được thay bằng identity deterministic theo D27; không được tạo duplicate khi parse lại cùng record.
- Chi tiết thư viện parser, schema bảng local, debounce interval, concurrency limit và worker orchestration là nội dung planning/implementation, không phải quyết định sản phẩm của spec này.
- Hành vi ingestion dùng @doc/specs/2026-08-09/local-file-ingestion-and-synchronization; local-first queue dùng @doc/specs/2026-08-10/offline-desktop-server-sync; parse-before-upload dùng @doc/specs/2026-08-10/desktop-parse-before-server-upload.
- Cảnh báo favicon.ico 404 chỉ cần xử lý trong một work item asset tĩnh riêng nếu muốn; không làm thay đổi parser, import contract hoặc acceptance của spec này.

## Task Links

- @task-i3beyy [desktop-data-source-folder-ingestion-01] Add source registry and multi-source watcher persistence — done
- @task-p0zoqt [desktop-data-source-folder-ingestion-02] Build desktop add-source folder picker and source UI — done
- @task-bnuso1 [desktop-data-source-folder-ingestion-03] Wire queued scans to parsers, Raw, ChangeSets and local-first persistence — done
- @task-aobrj5 [desktop-data-source-folder-ingestion-04] Add ingestion preview, mapping and error status flow — done
- @task-kimegz [desktop-data-source-folder-ingestion-05] Run integrated offline import, sync and SDD verification — done
- @task-fqzovh [desktop-data-source-folder-ingestion-06] Complete CSV and Word parser coverage — todo
- @task-hc5m2d [desktop-data-source-folder-ingestion-07] Add deterministic identity and revision diff — todo
- @task-ho64sc [desktop-data-source-folder-ingestion-08] Complete preview, mapping and ChangeSet review UI — todo
- @task-t9mo1e [desktop-data-source-folder-ingestion-09] Harden local persistence, assets, audit and source archive — todo
- @task-746tlu [desktop-data-source-folder-ingestion-10] Complete conflict-aware sync and approval — todo
- @task-724y4b [desktop-data-source-folder-ingestion-11] Add background progress, cancellation and file isolation — todo
- @task-at3xfd [desktop-data-source-folder-ingestion-12] Run integrated parsing and SDD verification — todo

Existing tasks 01-05 cover the previously implemented D1-D7 scope. Tasks 06-12 cover the new D8-D31 decisions.

## Open Questions

- [x] Quyền đăng ký source và xác nhận preview/ChangeSet — đã khóa tại D9.
- [x] Hỗ trợ Word .doc legacy hay chỉ .docx — đã khóa hỗ trợ cả hai tại D8.
- [x] Gỡ source có giữ lịch sử hay không — đã khóa archive/giữ lịch sử tại D10.
- [x] Các câu hỏi mới về fallback, normalization, conflict, CSV, asset, watcher, retention, identity, schema và review — đã khóa tại D11-D31.
- Không còn open question bắt buộc trước khi lập plan; mọi thay đổi các Locked Decisions sau khi spec được approve phải quay lại trạng thái draft/review.
