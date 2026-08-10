import { Button, Icon, KpiCard, PageHeader, Panel, StatusBadge } from "../../shared/ui";

export function OperateView({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="page">
      <PageHeader
        status="Field sync online"
        subtitle="Triển khai field package, xác minh hiện trường, GPS, ảnh và đồng bộ ChangeSet về DATACENTER."
        title="OPERATE"
        tone="success"
        actions={<><Button onClick={() => onAction("Đang mở danh sách thiết bị")}>Quản lý thiết bị</Button><Button primary onClick={() => onAction("Đang tạo Field Package mới")}><Icon name="plus" size={14} />Tạo Field Package</Button></>}
      />
      <div className="kpi-grid">
        <KpiCard icon="box" label="Field packages" value="12" foot={<><span className="delta up">8 active</span><span>4 completed</span></>} />
        <KpiCard icon="check" label="Verified today" value="47" foot={<><span className="delta up">+18%</span><span>so với hôm qua</span></>} />
        <KpiCard icon="refresh" label="Pending upload" value="8" foot={<><span className="delta warn">23 ảnh</span><span>đang chờ Wi-Fi</span></>} />
        <KpiCard icon="alert" label="Field conflicts" value="3" foot={<><span className="delta down">cần xử lý</span><span>trước approval</span></>} />
      </div>
      <div className="grid-12">
        <Panel className="col-8" title="Field Package Deployment" subtitle="Work package → entities → offline client" action={<Button onClick={() => onAction("Đã publish các package được chọn")}>Publish selected</Button>}>
          <div className="panel-body">
            <div className="workflow">
              <div className="workflow-step"><div className="workflow-kicker">01 • Prepare</div><div className="workflow-title">WP-CAM-03</div><div className="workflow-meta">146 Camera • Nhà thầu A</div></div>
              <div className="workflow-step"><div className="workflow-kicker">02 • Publish</div><div className="workflow-title">Package v7</div><div className="workflow-meta">24.8 MB • map + entities</div></div>
              <div className="workflow-step"><div className="workflow-kicker">03 • Offline</div><div className="workflow-title">4 thiết bị</div><div className="workflow-meta">Last sync 11 phút</div></div>
              <div className="workflow-step"><div className="workflow-kicker">04 • Verify</div><div className="workflow-title">103 / 146</div><div className="workflow-meta">71% hoàn thành</div></div>
            </div>
            <div className="progress large"><span style={{ width: "71%" }} /></div>
          </div>
          <div className="toolbar">
            <input className="filter-input" placeholder="Tìm package…" aria-label="Tìm field package" />
            <select className="select" aria-label="Lọc field package" defaultValue="all"><option value="all">Tất cả trạng thái</option><option value="active">Đang triển khai</option><option value="done">Hoàn tất</option></select>
          </div>
          <div className="panel-body flush table-wrap">
            <table>
              <thead><tr><th>Package</th><th>Nhà thầu</th><th>Entities</th><th>Verified</th><th>Sync</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td className="entity-code">FP-CAM-003</td><td>Nhà thầu A</td><td>146</td><td>103</td><td>11 phút</td><td><StatusBadge tone="info">Active</StatusBadge></td></tr>
                <tr><td className="entity-code">FP-CAM-004</td><td>Nhà thầu B</td><td>82</td><td>78</td><td>2 phút</td><td><StatusBadge tone="success">Near complete</StatusBadge></td></tr>
                <tr><td className="entity-code">FP-CAM-006</td><td>Nhà thầu C</td><td>66</td><td>21</td><td>1 giờ</td><td><StatusBadge tone="warning">Offline device</StatusBadge></td></tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="col-4" title="Mobile field preview" subtitle="Offline-first experience" action={<StatusBadge tone="neutral">Android</StatusBadge>}>
          <div className="panel-body">
            <div className="mobile-preview">
              <div className="mobile-status"><span>15:48</span><span>Offline • 78%</span></div>
              <div className="mobile-head"><b>FP-CAM-003</b><div>NG-031 • 4 Camera còn lại</div></div>
              <div className="mobile-map"><div className="map-grid" /><div className="road r1" /><div className="road r2" /><div className="camera-pin p2" /><div className="node-pin n1" /></div>
              <div className="mobile-list">
                <div className="mobile-item"><b>CAM-001</b><StatusBadge tone="success">Done</StatusBadge><div className="meta-line">GPS 2.7 m • 3 photos</div></div>
                <div className="mobile-item"><b>CAM-002</b><StatusBadge tone="warning">Verify</StatusBadge><div className="meta-line">Designed location 48 m away</div></div>
              </div>
              <div className="mobile-bottom"><span>Map</span><span>Tasks</span><span>Sync 8</span></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}


