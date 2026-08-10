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
        status="Projection lag 1.7s"
        subtitle="Read model điều hành: tiến độ, nhà thầu, field verification, dữ liệu, cảnh báo và forecast dự án."
        title="DASHBOARD"
        tone="success"
        actions={<><Button onClick={() => onAction("Đang hiển thị dữ liệu 7 ngày gần nhất")}>7 ngày</Button><Button onClick={() => onAction("Dashboard đã được làm mới")}><Icon name="refresh" size={14} />Làm mới</Button><Button primary onClick={() => onAction("Đang chuẩn bị báo cáo dự án")}>Xuất báo cáo</Button></>}
      />
      <div className="kpi-grid">
        <KpiCard icon="chart" label="Tiến độ tổng thể" value="68.4%" foot={<><span className="delta down">−4.8%</span><span>so với baseline</span></>} />
        <KpiCard icon="check" label="Field verified" value="721" foot={<><span className="delta up">+47 hôm nay</span><span>/ 1,230 camera</span></>} />
        <KpiCard icon="git" label="Pending approval" value="17" foot={<><span className="delta warn">5 quá 24h</span><span>cần xử lý</span></>} />
        <KpiCard icon="alert" label="Forecast delay" value="+8 ngày" foot={<><span className="delta down">CTR-B</span><span>là critical path</span></>} />
      </div>
      <div className="grid-12 mb-14">
        <Panel className="col-8" title="Planned vs Actual — 7 tuần" subtitle="Camera verification progress" action={<span className="muted">Last updated 16:12:31</span>}>
          <div className="panel-body"><div className="mini-chart"><div className="bar" style={{ height: "35%" }}><span>W1</span></div><div className="bar" style={{ height: "44%" }}><span>W2</span></div><div className="bar" style={{ height: "53%" }}><span>W3</span></div><div className="bar" style={{ height: "62%" }}><span>W4</span></div><div className="bar" style={{ height: "67%" }}><span>W5</span></div><div className="bar" style={{ height: "74%" }}><span>W6</span></div><div className="bar" style={{ height: "81%" }}><span>W7</span></div><div className="bar actual" style={{ height: "68%" }}><span>Actual</span></div></div></div>
        </Panel>
        <Panel className="col-4" title="Project health" subtitle="Weighted operating signals">
          <div className="panel-body"><div className="donut-wrap"><Donut center="82" segments="var(--success) 0 68%, var(--warning) 68% 84%, var(--danger) 84% 91%, var(--surface-3) 91% 100%" /><div className="legend"><div className="legend-row"><span className="legend-key"><i className="legend-dot success" />Healthy</span><b>68%</b></div><div className="legend-row"><span className="legend-key"><i className="legend-dot warning" />At risk</span><b>16%</b></div><div className="legend-row"><span className="legend-key"><i className="legend-dot danger" />Critical</span><b>7%</b></div><div className="legend-row"><span className="legend-key"><i className="legend-dot neutral" />Unknown</span><b>9%</b></div></div></div></div>
        </Panel>
      </div>
      <div className="grid-12">
        <Panel className="col-7" title="Work package schedule variance" subtitle="Baseline và actual progress">
          <div className="panel-body gantt">
            {[
              ["WP-CAM-01 • CTR-A", "62%", "57%", false],
              ["WP-CAM-03 • CTR-A", "68%", "49%", false],
              ["WP-CAM-04 • CTR-B", "70%", "34%", true],
              ["WP-CAM-06 • CTR-C", "51%", "32%", false],
            ].map(([label, plan, actual, late]) => (
              <div className="gantt-row" key={label as string}><span className="gantt-label">{label}</span><div className="gantt-track"><i className="gantt-plan" style={{ width: plan as string }} /><i className={"gantt-actual" + (late ? " gantt-late" : "")} style={{ width: actual as string }} /></div></div>
            ))}
          </div>
        </Panel>
        <Panel className="col-5" title="Cảnh báo điều hành" subtitle="Rules + projection signals" action={<StatusBadge tone="danger">4 alerts</StatusBadge>}>
          <AlertList items={[
            { title: "WP-CAM-04 dự kiến trễ 8 ngày", meta: "Năng suất 7 ngày: 13.2 camera/ngày, yêu cầu 20.", tone: "danger" },
            { title: "5 approval tồn đọng quá 24 giờ", meta: "Ảnh hưởng việc phát hành As-Built.", tone: "warning" },
            { title: "21 Camera thiếu ảnh nghiệm thu", meta: "Có thể làm giảm Data Quality Gate của đợt bàn giao.", tone: "warning" },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
