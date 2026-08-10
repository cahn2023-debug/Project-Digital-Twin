---
title: Desktop parse before server upload
description: Specification for desktop-side parsing and normalization before upload, with raw-file server fallback.
createdAt: '2026-08-10T05:20:06.499Z'
updatedAt: '2026-08-10T06:15:05.377Z'
tags:
  - spec
  - approved
  - desktop
  - parsing
  - upload
  - server-fallback
---

## Overview

Đặc tả riêng cho pipeline trong desktop app: mọi file phải được nhận diện và parsing/chuẩn hóa tại desktop trước khi upload payload dữ liệu lên server. Khi desktop không thể parse an toàn, app được phép upload raw file để server thử parsing lại; hai luồng này phải được phân biệt rõ về trạng thái, provenance, lỗi và audit.

Spec này bổ sung chi tiết cho các spec ingestion/sync hiện có, đặc biệt [Desktop data source folder ingestion](specs/2026-08-10/desktop-data-source-folder-ingestion) và [Local file ingestion and synchronization](specs/2026-08-09/local-file-ingestion-and-synchronization).

## Locked Decisions

- D1: Nếu desktop parsing thất bại hoặc dữ liệu không hợp lệ, app vẫn cho phép upload raw file để server parsing lại.
- D2: Ưu tiên parsing Excel/XLSX, CSV, TXT, Markdown và Word; kiến trúc cho phép mở rộng theo source profile. Định dạng chưa hỗ trợ sẽ upload raw.
- D3: Khi parsing thành công, desktop chỉ upload payload đã parse/chuẩn hóa kèm metadata và parse report; raw file được giữ local.
- D4: Batch xử lý độc lập từng file; file parse thành công upload payload chuẩn hóa, file lỗi upload raw kèm trạng thái lỗi.
- D5: Sau khi parse xong, app tự động upload ngay theo kết quả từng file; UI hiển thị trạng thái và hỗ trợ retry.
- D6: Server trả kết quả parsing theo từng file; thành công thì tạo dữ liệu chuẩn hóa, thất bại thì trả lỗi chi tiết và giữ trạng thái `FAILED` để retry.
- D7: Dùng fingerprint/idempotency; file không đổi không upload lại và retry không tạo bản ghi trùng.
- D8: File có cấu trúc hợp lệ nhưng chứa dòng lỗi sẽ upload các dòng hợp lệ; dòng lỗi bị loại và được ghi trong parse report/warning.
- D9: Mỗi record đã parse phải truy xuất được về source file và vị trí gốc, như sheet/row hoặc section/line.
- D10: Field chưa có mapping được giữ dưới dạng `unmapped`, vẫn upload cùng cảnh báo và ghi vào parse report.
- D11: Desktop áp dụng rule chuẩn hóa xác định; giá trị vẫn mơ hồ sẽ giữ nguyên giá trị gốc, phát warning và không tự đoán.
- D12: Dòng thiếu trường bắt buộc bị loại khỏi payload chuẩn hóa và ghi lỗi cụ thể; các dòng hợp lệ trong cùng file vẫn được upload.
- D13: Chỉ tự động parse khi có đúng một source profile khớp; trường hợp không rõ ràng sẽ upload raw kèm lý do.
- D14: UI hiển thị trạng thái từng file theo vòng đời parsing/upload, bao gồm trạng thái thành công một phần, lỗi và raw đã upload.
- D15: Retry độc lập từng file và tiếp tục từ bước lỗi; các file đã thành công không bị chạy lại.
- D16: Lỗi phải hiển thị file, vị trí lỗi, loại lỗi, nguyên nhân, hướng xử lý và trạng thái raw upload.
- D17: Khi mất mạng, payload đã parse được lưu vào local outbox; app tự động upload lại khi có mạng và không parse lại file.
- D18: Raw file upload fallback chỉ được lưu tạm trên server để parsing; sau khi có kết quả, server xóa raw và giữ metadata cùng parse report.
- D19: Server dùng kết quả parsing của mình làm bản đề xuất với trạng thái `SERVER_PARSED`; nếu khác với dữ liệu desktop dự kiến hoặc metadata nguồn, hệ thống đánh dấu `CONFLICT_REVIEW` và phải được duyệt trước khi ghi vào canonical state.
- D20: Parse report và lịch sử retry được lưu theo vòng đời project để audit và đối soát.

## System Decision Impact

- Impact: draft new
- Decision: none
- Acceptance gate: Integration tests phải chứng minh desktop upload đúng loại payload, server xử lý fallback raw, kết quả mismatch đi vào `CONFLICT_REVIEW`, raw tạm được xóa sau khi có kết quả, và retry không tạo dữ liệu trùng.

## Requirements

### Functional Requirements

- FR-1: Desktop phải xác định source profile cho từng file trước khi chọn parser. Chỉ profile duy nhất và hợp lệ mới được tự động parse; file unsupported, không khớp hoặc khớp nhiều profile phải đi theo raw fallback và ghi lý do.
- FR-2: Với file có profile hợp lệ, desktop phải hoàn tất parsing và chuẩn hóa local trước khi tạo payload upload. Payload thành công không được chứa raw file.
- FR-3: Parser phải hỗ trợ trước hết Excel/XLSX, CSV, TXT, Markdown và Word; profile mới có thể bổ sung parser mà không thay đổi nguyên tắc upload gate.
- FR-4: Parser phải tạo normalized records, parse report, fingerprint, profile identifier/version và provenance tới source file cùng vị trí gốc.
- FR-5: Parser phải giữ field chưa mapping trong vùng `unmapped`, ghi warning và không được tự ý loại bỏ dữ liệu đó.
- FR-6: Parser phải áp dụng rule chuẩn hóa xác định cho kiểu ngày, số và boolean. Giá trị mơ hồ giữ nguyên giá trị gốc và tạo warning; không được tự đoán im lặng.
- FR-7: Dòng thiếu trường bắt buộc hoặc không hợp lệ phải bị loại khỏi normalized payload, ghi lỗi có vị trí cụ thể; các dòng hợp lệ vẫn được upload.
- FR-8: Desktop phải upload tự động theo từng file ngay sau parsing. Trong một batch, kết quả thành công, partial, failed và raw fallback của các file độc lập với nhau.
- FR-9: Desktop phải hiển thị trạng thái và parse report theo từng file; lỗi phải có đủ thông tin để người dùng xác định nguyên nhân và hành động tiếp theo.
- FR-10: Retry phải theo từng file, tiếp tục từ bước lỗi, tôn trọng fingerprint/idempotency và không chạy lại hoặc tạo trùng cho file đã hoàn tất.
- FR-11: Nếu mất mạng, normalized payload và trạng thái upload phải được lưu trong local outbox; khi có mạng, app tiếp tục upload payload đã parse mà không parse lại.
- FR-12: Khi desktop không parse được, raw file được upload tới server kèm source metadata, fingerprint và lý do fallback. Server phải trả kết quả theo từng file.
- FR-13: Server phải xóa raw fallback sau khi có kết quả parsing, giữ metadata và parse report; nếu server result khác dữ liệu desktop dự kiến hoặc provenance liên quan, phải tạo `CONFLICT_REVIEW` trước canonical commit.
- FR-14: Hệ thống phải lưu parse report, warning/error, lịch sử retry và trạng thái cuối theo vòng đời project.

### Non-Functional Requirements

- NFR-1: Không được silently drop dữ liệu: mọi record/field bị loại, giữ raw hoặc chuyển thành `unmapped` phải có lý do trong parse report.
- NFR-2: Upload phải idempotent theo fingerprint và/hoặc ingestion identifier; retry, mất ACK hoặc reconnect không được tạo bản ghi trùng.
- NFR-3: Trạng thái parsing/upload và kết quả server phải có thể quan sát ở mức từng file, không chỉ ở mức batch.
- NFR-4: Việc parsing và upload nền không được làm mất dữ liệu hoặc làm treo thao tác UI chính; tiến trình và trạng thái phải được cập nhật nhất quán.
- NFR-5: Raw fallback trên server phải có vòng đời tạm thời, không được tồn tại sau khi server đã trả kết quả parsing.
- NFR-6: Dữ liệu truyền lên server phải tuân thủ cơ chế xác thực, phân quyền và bảo mật truyền tải hiện hành của hệ thống.

## Acceptance Criteria

- [ ] AC-1: Với một file Excel/CSV/TXT/Markdown/Word có đúng một profile khớp, desktop parse và chuẩn hóa local trước; request upload chỉ chứa normalized payload, metadata và parse report, không chứa raw file.
- [ ] AC-2: Với file unsupported, không khớp profile, khớp nhiều profile hoặc desktop parser thất bại, desktop upload raw kèm lý do; UI hiển thị trạng thái raw fallback và nhận kết quả riêng từ server.
- [ ] AC-3: Với file có 100 dòng trong đó 95 dòng hợp lệ và 5 dòng lỗi, payload chuẩn hóa chứa 95 dòng; 5 dòng lỗi không được upload trong payload chuẩn hóa và được liệt kê theo vị trí trong parse report.
- [ ] AC-4: Field chưa mapping xuất hiện trong vùng `unmapped` kèm warning; giá trị kiểu dữ liệu mơ hồ giữ nguyên giá trị gốc và không bị tự đoán.
- [ ] AC-5: Mỗi normalized record có thể truy ngược tới source file và vị trí gốc tương ứng.
- [ ] AC-6: Trong batch nhiều file, file thành công được upload dù file khác failed/raw fallback; trạng thái từng file phản ánh đúng kết quả.
- [ ] AC-7: Retry một file failed chỉ chạy lại file/bước lỗi; file đã synced không bị parse/upload lại và không tạo bản ghi trùng.
- [ ] AC-8: Khi offline sau parsing, payload được lưu local outbox; khi online trở lại, app upload chính payload đó mà không parse lại.
- [ ] AC-9: UI hiển thị đầy đủ vòng đời trạng thái và lỗi có file, vị trí, loại lỗi, nguyên nhân, hướng xử lý và trạng thái raw upload.
- [ ] AC-10: Server parsing raw thành công tạo kết quả `SERVER_PARSED`; raw tạm bị xóa sau khi có kết quả và parse report/metadata vẫn còn.
- [ ] AC-11: Khi server result khác dữ liệu desktop dự kiến hoặc metadata nguồn, hệ thống tạo `CONFLICT_REVIEW` và không ghi canonical state trước khi người dùng duyệt.
- [ ] AC-12: Parse report và lịch sử retry của file vẫn truy vấn được trong suốt vòng đời project.

## Scenarios

### Scenario 1: Known profile — desktop parse trước upload

**Given** một file XLSX khớp duy nhất với source profile đã biết.  
**When** desktop quét file.  
**Then** desktop parse/chuẩn hóa local, tạo fingerprint và provenance, sau đó tự động upload normalized payload kèm metadata/report; raw file không được gửi trong request thành công.

### Scenario 2: Unsupported hoặc ambiguous profile — raw fallback

**Given** một file có định dạng chưa được hỗ trợ hoặc khớp nhiều source profile.  
**When** desktop xử lý file.  
**Then** desktop không tự đoán parser; file được upload raw kèm lý do fallback, UI hiển thị trạng thái raw upload và server trả kết quả riêng theo file.

### Scenario 3: Partial parsing

**Given** một file có cả dòng hợp lệ và dòng thiếu trường bắt buộc.  
**When** desktop parse file.  
**Then** dòng hợp lệ được upload trong normalized payload, dòng lỗi bị loại, và parse report chỉ rõ file, vị trí, lỗi và hướng xử lý.

### Scenario 4: Unmapped và giá trị mơ hồ

**Given** file có field chưa mapping và giá trị ngày/số không xác định được.  
**When** desktop chuẩn hóa dữ liệu.  
**Then** field chưa mapping nằm trong `unmapped`; giá trị mơ hồ giữ nguyên gốc; cả hai đều có warning và không bị silently drop/guess.

### Scenario 5: Batch độc lập

**Given** một source có nhiều file, trong đó một file parse thành công, một file partial và một file failed.  
**When** batch tự động upload.  
**Then** mỗi file có trạng thái và kết quả riêng; file thành công không bị chặn bởi file failed.

### Scenario 6: Offline sau parsing

**Given** file đã parse thành công nhưng mạng bị mất trước khi server ACK.  
**When** desktop phát hiện offline.  
**Then** normalized payload được lưu vào local outbox; khi mạng trở lại app tiếp tục upload payload đó, không parse lại và không tạo bản ghi trùng.

### Scenario 7: Server fallback thành công

**Given** desktop không parse được raw file và đã upload raw lên server.  
**When** server parsing thành công.  
**Then** server tạo kết quả `SERVER_PARSED`, xóa raw tạm, giữ metadata/report và gửi kết quả về desktop.

### Scenario 8: Server fallback mismatch

**Given** server parsing raw tạo kết quả khác dữ liệu desktop dự kiến hoặc provenance liên quan.  
**When** server chuẩn bị ghi canonical state.  
**Then** hệ thống tạo `CONFLICT_REVIEW`, giữ kết quả server như bản đề xuất và chờ người dùng duyệt.

### Scenario 9: Retry và idempotency

**Given** một file upload thất bại hoặc ACK bị mất sau khi server đã nhận.  
**When** người dùng retry hoặc worker tự retry.  
**Then** app tiếp tục từ bước lỗi, server nhận diện fingerprint/ingestion identifier và không tạo bản ghi trùng.

## Technical Notes
- Normalized payload tối thiểu cần mang source identifier, file fingerprint, profile identifier/version, parser version, parse timestamp, parse report reference, provenance và các normalized records.
- Trạng thái file và trạng thái server cần có mapping rõ ràng để desktop không nhầm giữa desktop parse failure, raw upload, server parse failure, `SERVER_PARSED`, `CONFLICT_REVIEW` và canonical success.
- Chi tiết schema normalized, registry/source profile và giới hạn kích thước/batch được để cho bước planning/design; không thay đổi các quyết định D1–D20.
- Việc chọn thư viện/parser cụ thể và cách triển khai local outbox là quyết định triển khai, không thuộc phạm vi khóa của spec này.

- @task-ijh7t3 [desktop-parse-before-server-upload-01] Chuẩn hóa desktop parse gate và normalized payload — done
- @task-r3nkb7 [desktop-parse-before-server-upload-02] Tích hợp auto-upload, trạng thái file, retry và offline outbox — done
- @task-drpdus [desktop-parse-before-server-upload-03] Implement server raw fallback parsing và conflict review — done
- @task-dt5dz4 [desktop-parse-before-server-upload-04] Lưu parse report và retry history theo project — done
- @task-opsvq7 [desktop-parse-before-server-upload-05] Integrated verification và SDD compliance — done

## Open Questions

- [ ] Schema normalized và danh sách trường bắt buộc cho từng source profile sẽ được chốt ở bước planning/design?
- [ ] Giới hạn kích thước file, số record và kích thước batch upload cần đặt ngưỡng cụ thể nào?
- [ ] Ai sở hữu/quản lý việc publish và version hóa source profile/parser rules?
