import { Button, Icon, KpiCard, PageHeader, Panel, StatusBadge } from "../../shared/ui";

export function OperateView({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="page">
      <PageHeader
        status="Field sync online"
        subtitle="Triển khai field package, xác minh hiện trường, GPS, ảnh và đồng bộ ChangeSet về DATACENTER."
        title="OPERATE"
        tone="success"
        actions={
          <>
            <Button onClick={() => onAction("Đang mở danh sách thiết bị")}>Quản lý thiết bị</Button>
            <Button primary onClick={() => onAction("Đang tạo Field Package mới")}>
              <Icon name="plus" size={14} />Tạo Field Package
            </Button>
          </>
        }
      />
      <div className="kpi-grid">
        <KpiCard icon="box" label="Field packages" value="0" foot={<><span className="delta">0 active</span><span>0 completed</span></>} />
        <KpiCard icon="check" label="Verified today" value="0" foot={<><span className="delta">0%</span><span>chưa có dữ liệu</span></>} />
        <KpiCard icon="refresh" label="Pending upload" value="0" foot={<><span className="delta">0 ảnh</span><span>đang chờ</span></>} />
        <KpiCard icon="alert" label="Field conflicts" value="0" foot={<><span className="delta">0 xung đột</span><span>cần xử lý</span></>} />
      </div>
      <div className="grid-12">
        <Panel
          className="col-8"
          title="Field Package Deployment"
          subtitle="Work package → entities → offline client"
          action={<Button onClick={() => onAction("Chưa chọn package để publish")}>Publish selected</Button>}
        >
          <div className="datacenter-empty-card" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
            <div className="datacenter-empty-icon" style={{ marginBottom: "1rem" }}>
              <Icon name="box" size={36} />
            </div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Chưa có Field Package nào</h3>
            <p style={{ margin: "0 0 1.25rem 0", color: "#666", fontSize: "0.9rem" }}>
              Tạo mới Field Package từ Work Package để chuyển dữ liệu xuống thiết bị di động hiện trường.
            </p>
            <Button primary onClick={() => onAction("Đang khởi tạo Field Package mới")}>
              <Icon name="plus" size={14} /> Tạo Field Package mới
            </Button>
          </div>
        </Panel>
        <Panel className="col-4" title="Mobile field preview" subtitle="Offline-first experience" action={<StatusBadge tone="neutral">Ready</StatusBadge>}>
          <div className="panel-body">
            <div className="mobile-preview" style={{ opacity: 0.7 }}>
              <div className="mobile-status"><span>--:--</span><span>Offline • 100%</span></div>
              <div className="mobile-head"><b>Chưa có Package</b><div>Sẵn sàng nhận dữ liệu</div></div>
              <div className="mobile-map" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "0.85rem" }}>
                Bản đồ hiện trường trống
              </div>
              <div className="mobile-list">
                <div style={{ padding: "1rem", textAlign: "center", color: "#888", fontSize: "0.85rem" }}>
                  Chưa có nhiệm vụ xác minh
                </div>
              </div>
              <div className="mobile-bottom"><span>Map</span><span>Tasks</span><span>Sync 0</span></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
