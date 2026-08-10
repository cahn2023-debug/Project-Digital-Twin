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
          value="1,842"
          foot={<><span className="delta up">+32</span><span>từ lần sync gần nhất</span></>}
        />
        <KpiCard
          icon="file"
          label="Nguồn được quản lý"
          value="46"
          foot={<><span>39 synced</span><span>•</span><span className="delta warn">7 local-only</span></>}
        />
        <KpiCard
          icon="git"
          label="Pending changes"
          value="17"
          foot={<><span className="delta warn">8</span><span>từ hiện trường</span></>}
        />
        <KpiCard
          icon="check"
          label="Data quality"
          value="94.6%"
          foot={<><span className="delta up">+1.8%</span><span>7 ngày</span></>}
        />
      </div>
      <div className="grid-12 mb-14">
        <Panel
          className="col-8"
          title="Camera Dataset"
          subtitle="Canonical view • CameraMaster.xlsx • Revision 18"
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
            <div className="muted toolbar-count">1,230 bản ghi</div>
          </div>
          <div className="panel-body flush table-wrap camera-table">
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
          </div>
        </Panel>
        <SourceManagementPanel model={sourceManagement} />
      </div>
      <div className="grid-12">
        <Panel
          className="col-7"
          title="Change Inbox"
          subtitle="Thay đổi cần xem xét trước khi cập nhật canonical state"
          action={<StatusBadge tone="warning">17 pending</StatusBadge>}
        >
          <div className="panel-body flush table-wrap">
            <table>
              <thead><tr><th>ChangeSet</th><th>Entity</th><th>Nguồn</th><th>Thay đổi</th><th>Trạng thái</th></tr></thead>
              <tbody>
                <tr><td className="mono">#CS-0281</td><td><span className="entity-code">CAM-114</span></td><td>OPERATE / Field</td><td>Vị trí lệch 4.3 m</td><td><StatusBadge tone="danger">Conflict</StatusBadge></td></tr>
                <tr><td className="mono">#CS-0280</td><td><span className="entity-code">CAM-002</span></td><td>OPERATE / Field</td><td>GPS + 3 ảnh</td><td><StatusBadge tone="warning">Approval</StatusBadge></td></tr>
                <tr><td className="mono">#CS-0279</td><td><span className="entity-code">CAM-398</span></td><td>DATACENTER / Excel</td><td>IP 10.102.3.17 → .18</td><td><StatusBadge tone="info">Validating</StatusBadge></td></tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="col-5" title="Data Quality" subtitle="Các vấn đề cần xử lý" action={<Button onClick={() => onAction("Đang mở toàn bộ cảnh báo chất lượng dữ liệu")}>Xem tất cả</Button>}>
          <AlertList items={[
            { title: "3 Camera trùng mã định danh", meta: "Cần xử lý trước lần publish tiếp theo.", tone: "danger" },
            { title: "21 Camera thiếu ảnh nghiệm thu", meta: "Thuộc WP-CAM-03 và WP-CAM-04.", tone: "warning" },
            { title: "7 file đang ở chế độ local-only", meta: "Metadata đã đăng ký, binary chưa publish lên server.", tone: "info" },
          ]} />
        </Panel>
      </div>
    </div>
  );
}


