import { useMemo } from "react";
import { cameraRows } from "./data";
import { SourceManagementPanel, useSourceManagement } from "./SourceManagement";
import { Button, Icon, KpiCard, PageHeader, Panel, StatusBadge, AlertList } from "../../shared/ui";

export function DatacenterView({
  onAction,
  onSearchChange,
  projectId,
  searchQuery,
}: {
  onAction: (message: string) => void;
  onSearchChange: (value: string) => void;
  projectId: string | null;
  searchQuery: string;
}) {
  const cameras = cameraRows;
  const sourceManagement = useSourceManagement(projectId, onAction);
  const filteredCameras = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return cameras;
    return cameras.filter((row) => row.join(" ").toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <div className="page">
      <PageHeader
        status="Data core healthy"
        subtitle="Quản trị nguồn dữ liệu, canonical entities, phiên bản file, ChangeSet và chất lượng dữ liệu của toàn dự án."
        title="DATACENTER"
        tone="success"
        actions={
          <>
            <Button onClick={() => onAction("Đang quét thay đổi trong thư mục dự án")}>
              <Icon name="refresh" size={14} />
              Quét thay đổi
            </Button>
            <Button primary onClick={() => void sourceManagement.addSource()}>
              <Icon name="plus" size={14} />
              Thêm nguồn dữ liệu
            </Button>
          </>
        }
      />
      <div className="kpi-grid">
        <KpiCard
          icon="db"
          label="Canonical entities"
          value={cameras.length > 0 ? String(cameras.length) : "0"}
          foot={<><span>Chưa có bản ghi</span></>}
        />
        <KpiCard
          icon="file"
          label="Nguồn được quản lý"
          value={sourceManagement.sources.length > 0 ? String(sourceManagement.sources.length) : "0"}
          foot={<><span>{sourceManagement.sources.length} nguồn</span></>}
        />
        <KpiCard
          icon="git"
          label="Pending changes"
          value="0"
          foot={<><span>0 thay đổi</span></>}
        />
        <KpiCard
          icon="check"
          label="Data quality"
          value="100%"
          foot={<><span className="delta up">Sẵn sàng</span></>}
        />
      </div>
      <div className="grid-12 mb-14">
        <Panel
          className="col-8"
          title="Camera Dataset"
          subtitle={cameras.length > 0 ? "Canonical view" : "Chưa có dữ liệu camera"}
          action={<Button onClick={() => onAction("Đang mở Camera Dataset")}><Icon name="eye" size={13} />Mở dataset</Button>}
        >
          <div className="toolbar">
            <input className="filter-input" placeholder="Tìm camera…" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} aria-label="Tìm camera" />
            <select className="select" aria-label="Lọc trạng thái" defaultValue="all">
              <option value="all">Tất cả trạng thái</option>
              <option value="designed">Designed</option>
              <option value="as-built">As-built</option>
            </select>
            <Button onClick={() => onAction("Bộ lọc Camera Dataset đã sẵn sàng")}>
              <Icon name="filter" size={13} />
              Bộ lọc
            </Button>
            <div className="muted toolbar-count">{filteredCameras.length} bản ghi</div>
          </div>
          <div className="panel-body flush table-wrap camera-table">
            {filteredCameras.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", color: "var(--muted)" }}>
                  <Icon name="db" size={36} />
                </div>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>Chưa có dữ liệu camera</div>
                <div style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "16px" }}>
                  Dự án hiện chưa có bản ghi camera nào. Bạn có thể thêm nguồn dữ liệu mới để bắt đầu.
                </div>
                <Button primary onClick={() => void sourceManagement.addSource()}>
                  <Icon name="plus" size={14} />
                  Thêm nguồn dữ liệu
                </Button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr><th>Camera</th><th>Nút giao</th><th>IP</th><th>Thiết kế</th><th>As-built</th><th>Nguồn</th><th>Rev.</th></tr>
                </thead>
                <tbody>
                  {filteredCameras.map((row) => (
                    <tr key={row[0]}>
                      <td><span className="entity-code">{row[0]}</span></td>
                      <td>{row[1]}</td>
                      <td className="mono">{row[2]}</td>
                      <td><StatusBadge tone="info">{row[3]}</StatusBadge></td>
                      <td><StatusBadge tone={row[4] === "Verified" ? "success" : row[4] === "Pending" ? "warning" : row[4] === "Conflict" ? "danger" : "neutral"}>{row[4]}</StatusBadge></td>
                      <td>{row[5]}</td>
                      <td className="mono">{row[6]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
        <SourceManagementPanel model={sourceManagement} />
      </div>
      <div className="grid-12">
        <Panel
          className="col-7"
          title="Change Inbox"
          subtitle="Thay đổi cần xem xét trước khi cập nhật canonical state"
          action={<StatusBadge tone="neutral">0 pending</StatusBadge>}
        >
          <div className="panel-body flush table-wrap">
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
              Không có ChangeSet nào đang chờ xử lý.
            </div>
          </div>
        </Panel>
        <Panel className="col-5" title="Data Quality" subtitle="Các vấn đề cần xử lý" action={<Button onClick={() => onAction("Đang mở toàn bộ cảnh báo chất lượng dữ liệu")}>Xem tất cả</Button>}>
          <AlertList items={[
            { title: "Hệ thống dữ liệu sạch", meta: "Không phát hiện xung đột hoặc lỗi dữ liệu.", tone: "success" },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
