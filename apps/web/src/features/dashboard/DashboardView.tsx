import { Button, Icon, KpiCard, PageHeader, Panel, StatusBadge, AlertList } from "../../shared/ui";

function Donut({
  center,
  segments = "var(--success) 0 58%, var(--accent) 58% 78%, var(--warning) 78% 91%, var(--surface-3) 91% 100%",
}: {
  center: string;
  segments?: string;
}) {
  return (
    <div
      className="donut"
      style={{ background: "conic-gradient(" + segments + ")" }}
    >
      <div className="donut-center">
        <div>
          <b>{center}</b>
          <div className="meta-line">assigned</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardView({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="page">
      <PageHeader
        status="System Ready"
        subtitle="Read model điều hành: tiến độ, nhà thầu, field verification, dữ liệu, cảnh báo và forecast dự án."
        title="DASHBOARD"
        tone="success"
        actions={
          <>
            <Button onClick={() => onAction("Đang hiển thị dữ liệu 7 ngày gần nhất")}>7 ngày</Button>
            <Button onClick={() => onAction("Dashboard đã được làm mới")}><Icon name="refresh" size={14} />Làm mới</Button>
            <Button primary onClick={() => onAction("Đang chuẩn bị báo cáo dự án")}>Xuất báo cáo</Button>
          </>
        }
      />
      <div className="kpi-grid">
        <KpiCard icon="chart" label="Tiến độ tổng thể" value="0%" foot={<><span className="delta">0%</span><span>chưa có dữ liệu</span></>} />
        <KpiCard icon="check" label="Field verified" value="0" foot={<><span className="delta">0 hôm nay</span><span>/ 0 camera</span></>} />
        <KpiCard icon="git" label="Pending approval" value="0" foot={<><span className="delta">0 quá 24h</span><span>cần xử lý</span></>} />
        <KpiCard icon="alert" label="Forecast delay" value="0 ngày" foot={<><span className="delta">Chưa có</span><span>schedule baseline</span></>} />
      </div>
      <div className="grid-12 mb-14">
        <Panel className="col-8" title="Planned vs Actual" subtitle="Camera verification progress" action={<span className="muted">Làm mới lúc này</span>}>
          <div className="panel-body">
            <div className="datacenter-empty-card" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
              <div className="datacenter-empty-icon" style={{ marginBottom: "1rem" }}>
                <Icon name="chart" size={36} />
              </div>
              <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Chưa có dữ liệu tiến độ</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                Nhập danh sách camera hoặc phát hành Work Package để theo dõi tiến độ Planned vs Actual.
              </p>
            </div>
          </div>
        </Panel>
        <Panel className="col-4" title="Project health" subtitle="Weighted operating signals">
          <div className="panel-body">
            <div className="donut-wrap">
              <Donut center="0" segments="var(--surface-3) 0 100%" />
              <div className="legend">
                <div className="legend-row"><span className="legend-key"><i className="legend-dot success" />Healthy</span><b>0%</b></div>
                <div className="legend-row"><span className="legend-key"><i className="legend-dot warning" />At risk</span><b>0%</b></div>
                <div className="legend-row"><span className="legend-key"><i className="legend-dot danger" />Critical</span><b>0%</b></div>
                <div className="legend-row"><span className="legend-key"><i className="legend-dot neutral" />Unknown</span><b>100%</b></div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      <div className="grid-12">
        <Panel className="col-7" title="Work package schedule variance" subtitle="Baseline và actual progress">
          <div className="panel-body">
            <div style={{ padding: "2rem", textAlign: "center", color: "#888", fontSize: "0.9rem" }}>
              Chưa có Work Package nào được khởi tạo trong dự án.
            </div>
          </div>
        </Panel>
        <Panel className="col-5" title="Cảnh báo điều hành" subtitle="Rules + projection signals" action={<StatusBadge tone="success">0 cảnh báo</StatusBadge>}>
          <div className="panel-body">
            <div style={{ padding: "2rem", textAlign: "center", color: "#888", fontSize: "0.9rem" }}>
              Không có cảnh báo điều hành nào. Hệ thống hoạt động bình thường.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
