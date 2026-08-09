import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

type ModuleKey =
  | "datacenter"
  | "design"
  | "operate"
  | "organize"
  | "dashboard";
type IconName =
  | "alert"
  | "bell"
  | "box"
  | "camera"
  | "chart"
  | "check"
  | "chevron"
  | "db"
  | "edit"
  | "eye"
  | "file"
  | "filter"
  | "git"
  | "grid"
  | "map"
  | "menu"
  | "mobile"
  | "moon"
  | "plus"
  | "refresh"
  | "search"
  | "sun"
  | "users";
type Tone = "danger" | "info" | "neutral" | "success" | "warning";

type SideItem = {
  label: string;
  icon: IconName;
  key: string;
  count?: string;
};

type ModuleConfig = {
  label: string;
  icon: IconName;
  count?: string;
  sections: SideItem[];
};

const modules: Record<ModuleKey, ModuleConfig> = {
  datacenter: {
    label: "DATACENTER",
    icon: "db",
    count: "17",
    sections: [
      { label: "Tổng quan", icon: "grid", key: "overview" },
      { label: "Nguồn dữ liệu", icon: "file", key: "sources", count: "46" },
      { label: "Data Catalog", icon: "db", key: "catalog" },
      { label: "Camera Dataset", icon: "camera", key: "camera", count: "1,230" },
      { label: "Change Inbox", icon: "git", key: "changes", count: "17" },
      { label: "Data Quality", icon: "alert", key: "quality", count: "24" },
      { label: "File Versions", icon: "refresh", key: "versions" },
      { label: "Đồng bộ", icon: "refresh", key: "sync" },
    ],
  },
  design: {
    label: "DESIGN",
    icon: "map",
    sections: [
      { label: "Bản đồ thiết kế", icon: "map", key: "map" },
      { label: "Layers", icon: "grid", key: "layers", count: "12" },
      { label: "Camera", icon: "camera", key: "camera", count: "1,230" },
      { label: "Intersection", icon: "map", key: "intersection", count: "269" },
      { label: "Design Revisions", icon: "git", key: "revisions", count: "42" },
      { label: "Compare", icon: "eye", key: "compare" },
      { label: "Fiber Network", icon: "git", key: "fiber", count: "Phase 2" },
    ],
  },
  operate: {
    label: "OPERATE",
    icon: "mobile",
    count: "8",
    sections: [
      { label: "Tổng quan hiện trường", icon: "grid", key: "overview" },
      { label: "Field Packages", icon: "box", key: "packages", count: "12" },
      { label: "Verification", icon: "check", key: "verification", count: "47" },
      { label: "Field Map", icon: "map", key: "map" },
      { label: "Pending Sync", icon: "refresh", key: "sync", count: "8" },
      { label: "Observations", icon: "eye", key: "observations" },
      { label: "Conflicts", icon: "alert", key: "conflicts", count: "3" },
      { label: "Thiết bị mobile", icon: "mobile", key: "devices", count: "4" },
    ],
  },
  organize: {
    label: "ORGANIZE",
    icon: "box",
    sections: [
      { label: "Tổng quan", icon: "grid", key: "overview" },
      { label: "Nhà thầu", icon: "users", key: "contractors", count: "4" },
      { label: "Work Packages", icon: "box", key: "packages", count: "12" },
      { label: "Phân công Entity", icon: "git", key: "assignment", count: "850" },
      { label: "Vật tư", icon: "box", key: "materials", count: "Phase 2" },
      { label: "Giao nhận", icon: "file", key: "delivery", count: "Phase 2" },
      { label: "Trách nhiệm & quyền", icon: "users", key: "permission" },
    ],
  },
  dashboard: {
    label: "DASHBOARD",
    icon: "chart",
    count: "4",
    sections: [
      { label: "Executive Summary", icon: "chart", key: "summary" },
      { label: "Tiến độ", icon: "chart", key: "progress" },
      { label: "Nhà thầu", icon: "users", key: "contractors" },
      { label: "Field Verification", icon: "check", key: "field" },
      { label: "Data Quality", icon: "db", key: "quality" },
      { label: "Cảnh báo", icon: "alert", key: "alerts", count: "4" },
      { label: "Forecast", icon: "chart", key: "forecast" },
      { label: "Báo cáo", icon: "file", key: "reports" },
    ],
  },
};

const iconPaths: Record<IconName, ReactNode> = {
  alert: (
    <>
      <path
        d="M12 3 2.5 20h19L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12 9v5M12 17.5v.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  bell: (
    <>
      <path
        d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 20h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  box: (
    <>
      <path
        d="m4 7 8-4 8 4-8 4-8-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M4 7v10l8 4 8-4V7M12 11v10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  camera: (
    <>
      <path
        d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="13"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  chart: (
    <path
      d="M4 20V10M10 20V4M16 20v-7M22 20H2"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  ),
  check: (
    <path
      d="m5 12 4 4L19 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  ),
  chevron: (
    <path
      d="m7 10 5 5 5-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  db: (
    <>
      <ellipse
        cx="12"
        cy="5"
        rx="8"
        ry="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  edit: (
    <>
      <path
        d="M4 20h4L19 9l-4-4L4 16v4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m13 7 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  eye: (
    <>
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  file: (
    <>
      <path
        d="M6 2.5h8l4 4V21H6V2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M14 2.5v4h4M9 12h6M9 16h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  filter: (
    <path
      d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  ),
  git: (
    <>
      <circle
        cx="6"
        cy="5"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="18"
        cy="7"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="6"
        cy="19"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6 7v10M8 9c4 0 3-2 8-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  grid: (
    <>
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  map: (
    <>
      <path
        d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 4v13M16 7v13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  menu: (
    <path
      d="M4 6h16M4 12h16M4 18h16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  ),
  mobile: (
    <>
      <rect
        x="7"
        y="2.5"
        width="10"
        height="19"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 5h4M11 18.5h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  moon: (
    <path
      d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  ),
  plus: (
    <path
      d="M12 5v14M5 12h14"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  ),
  refresh: (
    <>
      <path
        d="M20 7v5h-5M4 17v-5h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M18 12a6 6 0 0 0-10.4-4M6 12a6 6 0 0 0 10.4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  search: (
    <>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m16 16 4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </>
  ),
  sun: (
    <>
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  users: (
    <>
      <circle
        cx="9"
        cy="8"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.5 20c0-4 2.2-6 5.5-6s5.5 2 5.5 6M15 5.5c2 0 3.5 1.5 3.5 3.5S17 12.5 15 12.5M16 15c2.8.3 4.5 2 4.5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
};

const cameraRows = [
  ["CAM-001", "NG-031 Nguyễn Trãi", "10.32.1.21", "Designed", "Verified", "CameraMaster.xlsx", "18"],
  ["CAM-002", "NG-031 Nguyễn Trãi", "10.32.1.22", "Designed", "Pending", "CameraMaster.xlsx", "18"],
  ["CAM-114", "NG-044 Trần Duy Hưng", "10.44.2.14", "Designed", "Conflict", "CameraMaster.xlsx", "18"],
  ["CAM-215", "NG-078 Kim Mã", "10.78.1.15", "Designed", "Verified", "CameraMaster.xlsx", "18"],
  ["CAM-216", "NG-078 Kim Mã", "10.78.1.16", "Designed", "Not deployed", "CameraMaster.xlsx", "18"],
  ["CAM-398", "NG-102 Tây Sơn", "10.102.3.18", "Designed", "Verified", "CameraMaster.xlsx", "18"],
];

const sourceRows = [
  { type: "XLSX", name: "CameraMaster.xlsx", meta: "MANAGED_FILE_MASTER • rev 18 • 2 phút trước", tone: "success" as Tone, state: "Synced" },
  { type: "SHP", name: "Intersection_269.shp", meta: "SOURCE_ONLY • rev 9 • 31 phút trước", tone: "success" as Tone, state: "Synced" },
  { type: "PDF", name: "BBNT_031.pdf", meta: "SOURCE_ONLY • local-only", tone: "warning" as Tone, state: "Local" },
  { type: "XLSX", name: "Contractor_A.xlsx", meta: "SOURCE_ONLY • rev 3 • hôm qua", tone: "success" as Tone, state: "Synced" },
];

const moduleTabs: ModuleKey[] = ["datacenter", "design", "operate", "organize", "dashboard"];

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  );
}

function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={"status " + tone}>{children}</span>;
}

function Panel({
  action,
  children,
  className = "",
  subtitle,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <div>
          <div className="panel-title">{title}</div>
          {subtitle ? <div className="panel-sub">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  foot,
}: {
  icon: IconName;
  label: string;
  value: string;
  foot: ReactNode;
}) {
  return (
    <article className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">{foot}</div>
    </article>
  );
}

function PageHeader({
  actions,
  subtitle,
  title,
  status,
  tone,
}: {
  actions: ReactNode;
  subtitle: string;
  title: string;
  status: string;
  tone: Tone;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="title-row">
          <h1>{title}</h1>
          <StatusBadge tone={tone}>{status}</StatusBadge>
        </div>
        <div className="page-subtitle">{subtitle}</div>
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}

function Button({
  children,
  onClick,
  primary = false,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      className={"btn" + (primary ? " primary" : "")}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function AlertList({
  items,
}: {
  items: Array<{ title: string; meta: string; tone: Tone; icon?: IconName }>;
}) {
  return (
    <div className="panel-body alert-list">
      {items.map((item) => (
        <div className="alert-item" key={item.title}>
          <div className={"alert-icon " + item.tone}>
            <Icon name={item.icon ?? "alert"} size={14} />
          </div>
          <div>
            <div className="alert-title">{item.title}</div>
            <div className="alert-meta">{item.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapMockup() {
  return (
    <div className="map-panel">
      <div className="map-grid" />
      <div className="road r1" />
      <div className="road r2" />
      <div className="road r3" />
      <div className="fiber-line" />
      <div className="camera-pin p1" />
      <div className="camera-pin p2" />
      <div className="camera-pin p3" />
      <div className="camera-pin p4" />
      <div className="node-pin n1" />
      <div className="map-popup">
        <div className="map-popup-title">CAM-114</div>
        <div className="map-popup-line">
          <span>Nút giao</span>
          <b>NG-044</b>
        </div>
        <div className="map-popup-line">
          <span>Representation</span>
          <b className="text-success">DESIGNED</b>
        </div>
        <div className="map-popup-line">
          <span>Model</span>
          <b>XNV-8080</b>
        </div>
      </div>
      <div className="map-controls">
        <button className="map-control" type="button" aria-label="Phóng to">+</button>
        <button className="map-control" type="button" aria-label="Thu nhỏ">−</button>
        <button className="map-control" type="button" aria-label="Đặt lại bản đồ">⌗</button>
      </div>
      <div className="map-layer-card">
        <b className="map-layer-title">Layers</b>
        <div className="layer-row">
          <span className="layer-swatch" />
          <span>Camera — Designed</span>
          <span className="layer-count">1,230</span>
        </div>
        <div className="layer-row">
          <span className="layer-swatch intersection" />
          <span>Intersection</span>
          <span className="layer-count">269</span>
        </div>
        <div className="layer-row">
          <span className="layer-swatch fiber" />
          <span>Fiber draft</span>
          <span className="layer-count">Off</span>
        </div>
      </div>
    </div>
  );
}

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

function DatacenterView({
  cameras,
  onAction,
  onSearchChange,
  searchQuery,
}: {
  cameras: typeof cameraRows;
  onAction: (message: string) => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
}) {
  const filteredCameras = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return cameras;
    return cameras.filter((row) => row.join(" ").toLowerCase().includes(query));
  }, [cameras, searchQuery]);

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
            <Button primary onClick={() => onAction("Mở hộp thoại đăng ký nguồn dữ liệu")}>
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
        <Panel
          className="col-4"
          title="Nguồn dữ liệu gần đây"
          subtitle="File Registry"
          action={<button className="icon-btn" type="button" aria-label="Mở File Registry" onClick={() => onAction("Đang mở File Registry")}><Icon name="file" size={15} /></button>}
        >
          <div className="panel-body">
            {sourceRows.map((source) => (
              <div className="source-row" key={source.name}>
                <div className={"file-icon " + source.type.toLowerCase()}>{source.type}</div>
                <div className="file-meta">
                  <div className="file-name">{source.name}</div>
                  <div className="meta-line">{source.meta}</div>
                </div>
                <StatusBadge tone={source.tone}>{source.state}</StatusBadge>
              </div>
            ))}
          </div>
        </Panel>
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

function DesignView({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="page">
      <PageHeader
        status="Revision D-042"
        subtitle="Không gian thiết kế Digital Twin: GIS, geometry và các representation DESIGNED độc lập với AS_BUILT."
        title="DESIGN"
        tone="info"
        actions={
          <>
            <Button onClick={() => onAction("Đang chuẩn bị so sánh revision")}><Icon name="git" size={14} />So sánh revision</Button>
            <Button primary onClick={() => onAction("Đã lưu bản nháp thiết kế")}><Icon name="check" size={14} />Lưu thiết kế</Button>
          </>
        }
      />
      <div className="grid-12">
        <Panel className="col-8" title="Bản đồ thiết kế" subtitle="EPSG:4326 • 1,230 Camera • 269 Intersection" action={<div className="panel-actions"><Button onClick={() => onAction("Chế độ chỉnh sửa bản đồ đã bật")}><Icon name="edit" size={13} />Chỉnh sửa</Button><Button onClick={() => onAction("Đang mở layer selector")}>Layers</Button></div>}>
          <MapMockup />
        </Panel>
        <Panel className="col-4" title="Inspector — CAM-114" subtitle="Canonical ID • 7ae9…91f2" action={<button className="icon-btn" type="button" aria-label="Chỉnh sửa CAM-114" onClick={() => onAction("Đang chỉnh sửa CAM-114")}><Icon name="edit" size={15} /></button>}>
          <div className="panel-body flush">
            <div className="property-list">
              <div className="label">Code</div><div className="value entity-code">CAM-114</div>
              <div className="label">Nút giao</div><div className="value">NG-044 • Trần Duy Hưng</div>
              <div className="label">Model</div><div className="value">Hanwha XNV-8080</div>
              <div className="label">Designed Lat</div><div className="value mono">21.0104821</div>
              <div className="label">Designed Lon</div><div className="value mono">105.8012319</div>
              <div className="label">As-built</div><div className="value"><StatusBadge tone="danger">Conflict</StatusBadge></div>
              <div className="label">Revision</div><div className="value mono">DESIGNED/3</div>
            </div>
            <div className="panel-body">
              <b className="subsection-title">Lịch sử thiết kế</b>
              <div className="timeline">
                <div className="timeline-item"><span className="timeline-dot" /><div className="timeline-title">Điều chỉnh hướng camera 12°</div><div className="timeline-meta">Rev 3 • Nguyễn A • hôm nay 14:21</div></div>
                <div className="timeline-item"><span className="timeline-dot" /><div className="timeline-title">Di chuyển vị trí thiết kế 1.2 m</div><div className="timeline-meta">Rev 2 • Nguyễn A • 07/08</div></div>
                <div className="timeline-item"><span className="timeline-dot" /><div className="timeline-title">Tạo từ CameraMaster.xlsx</div><div className="timeline-meta">Rev 1 • Import Job #184</div></div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OperateView({ onAction }: { onAction: (message: string) => void }) {
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

function OrganizeView({ onAction }: { onAction: (message: string) => void }) {
  const contractors = [
    ["Công ty Hạ tầng A", "CTR-A", "On track", "success", "312", "231", "74%"],
    ["Công ty Công nghệ B", "CTR-B", "At risk", "warning", "246", "131", "53%"],
    ["Liên danh C", "CTR-C", "Active", "info", "188", "109", "58%"],
    ["Nhà thầu D", "CTR-D", "Preparing", "neutral", "104", "0", "0%"],
  ] as const;

  return (
    <div className="page">
      <PageHeader
        status="4 nhà thầu"
        subtitle="Tổ chức nhà thầu, work package, phân công đối tượng và nền tảng logistics/vật tư của dự án."
        title="ORGANIZE"
        tone="info"
        actions={<><Button onClick={() => onAction("Đang mở import phân bổ")}>Nhập phân bổ</Button><Button primary onClick={() => onAction("Đang tạo Work Package mới")}><Icon name="plus" size={14} />Tạo Work Package</Button></>}
      />
      <div className="grid-12 mb-14">
        <Panel className="col-8" title="Nhà thầu & Work Package" subtitle="Entity assignment và tiến độ thực hiện" action={<Button onClick={() => onAction("Đang mở quyền truy cập nhà thầu")}>Quản lý quyền</Button>}>
          <div className="panel-body contractor-grid">
            {contractors.map(([name, code, state, tone, assigned, verified, progress]) => (
              <div className="contractor-card" key={code}>
                <div className="contractor-head"><div><div className="contractor-name">{name}</div><div className="contractor-code">{code}</div></div><StatusBadge tone={tone}>{state}</StatusBadge></div>
                <div className="contractor-stats"><div className="contractor-stat"><b>{assigned}</b><span>Assigned</span></div><div className="contractor-stat"><b>{verified}</b><span>Verified</span></div><div className="contractor-stat"><b>{progress}</b><span>Progress</span></div></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="col-4" title="Phân bổ theo trạng thái" subtitle="Toàn dự án">
          <div className="panel-body">
            <div className="donut-wrap"><Donut center="850" /><div className="legend"><div className="legend-row"><span className="legend-key"><i className="legend-dot success" />Verified</span><b>58%</b></div><div className="legend-row"><span className="legend-key"><i className="legend-dot accent" />In progress</span><b>20%</b></div><div className="legend-row"><span className="legend-key"><i className="legend-dot warning" />Pending</span><b>13%</b></div><div className="legend-row"><span className="legend-key"><i className="legend-dot neutral" />Not started</span><b>9%</b></div></div></div>
          </div>
        </Panel>
      </div>
      <div className="grid-12">
        <Panel className="col-7" title="Material lifecycle — preview" subtitle="Module mở rộng sau Camera MVP" action={<StatusBadge tone="neutral">Phase 2</StatusBadge>}>
          <div className="panel-body"><div className="material-grid"><div className="material-stage"><b>1,420</b><span>Planned</span></div><div className="material-stage"><b>1,180</b><span>Delivered</span></div><div className="material-stage"><b>934</b><span>Issued</span></div><div className="material-stage"><b>781</b><span>Installed</span></div></div></div>
        </Panel>
        <Panel className="col-5" title="Responsibility map" subtitle="Cross-contractor dependency">
          <AlertList items={[
            { title: "CTR-B cần read geometry của 17 tủ CTR-A", meta: "Phục vụ đấu nối camera thuộc WP-CAM-04.", tone: "info", icon: "users" },
            { title: "2 dependency chưa có quyền truy cập", meta: "Có thể chặn field package tiếp theo.", tone: "warning" },
          ]} />
        </Panel>
      </div>
    </div>
  );
}

function DashboardView({ onAction }: { onAction: (message: string) => void }) {
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

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("datacenter");
  const [activeSideItem, setActiveSideItem] = useState("overview");
  const [connection, setConnection] = useState({ label: "Đang kết nối API", tone: "warning" as Tone });
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("pp-theme");
    return saved === "dark" ? "dark" : "light";
  });
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(apiBase + "/health/live")
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json() as Promise<{ status: string }>;
      })
      .then((health) => setConnection({ label: "API " + health.status, tone: "success" }))
      .catch(() => setConnection({ label: "API offline", tone: "danger" }));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("pp-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setToast("Global Search sẵn sàng");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const showToast = (message: string) => setToast(message);
  const currentModule = modules[activeModule];
  const sidePrimary = currentModule.sections.slice(0, 6);
  const sideSecondary = currentModule.sections.slice(6);

  const activateModule = (module: ModuleKey) => {
    setActiveModule(module);
    setActiveSideItem(modules[module].sections[0].key);
  };

  const renderView = () => {
    if (activeModule === "datacenter") {
      return <DatacenterView cameras={cameraRows} onAction={showToast} onSearchChange={setSearchQuery} searchQuery={searchQuery} />;
    }
    if (activeModule === "design") return <DesignView onAction={showToast} />;
    if (activeModule === "operate") return <OperateView onAction={showToast} />;
    if (activeModule === "organize") return <OrganizeView onAction={showToast} />;
    return <DashboardView onAction={showToast} />;
  };

  return (
    <div className={"app-shell" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Icon name="grid" size={19} /></div>
          <div><div className="brand-title">Project Platform</div><div className="brand-sub">Digital Twin Workspace</div></div>
        </div>
        <div className="project-switcher">
          <div className="project-code">269</div>
          <div className="project-meta">
            <div className="project-name">Hệ thống giao thông thông minh — 269 nút</div>
            <div className="project-line"><span><i className={"sync-dot " + connection.tone} />{connection.label}</span><span>Revision 134</span></div>
          </div>
          <button className="icon-btn" type="button" aria-label="Đổi dự án" onClick={() => showToast("Project switcher sẵn sàng")}><Icon name="chevron" size={16} /></button>
        </div>
        <div className="topbar-spacer" />
        <label className="quick-search">
          <Icon name="search" size={15} />
          <input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm entity, file, nhà thầu…" aria-label="Tìm entity, file, nhà thầu" />
          <span className="shortcut">Ctrl K</span>
        </label>
        <button className="icon-btn" type="button" aria-label="Đổi giao diện" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></button>
        <button className="icon-btn" type="button" aria-label="Thông báo" onClick={() => showToast("Bạn không có thông báo mới")}><Icon name="bell" size={17} /></button>
        <div className="avatar">MH</div>
      </header>

      <aside className="sidebar">
        <div className="side-head"><span className="side-head-title">{currentModule.label}</span><button className="icon-btn" type="button" aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><Icon name="menu" size={17} /></button></div>
        <div className="side-scroll">
          <div className="side-section"><div className="side-label">Workspace</div>{sidePrimary.map((item) => <button className={"side-item" + (activeSideItem === item.key ? " active" : "")} key={item.key} type="button" onClick={() => { setActiveSideItem(item.key); showToast(currentModule.label + " / " + item.label); }}><Icon name={item.icon} size={16} /><span className="side-text">{item.label}</span>{item.count ? <span className="mini-count">{item.count}</span> : null}</button>)}</div>
          {sideSecondary.length ? <div className="side-section"><div className="side-label">Khác</div>{sideSecondary.map((item) => <button className={"side-item" + (activeSideItem === item.key ? " active" : "")} key={item.key} type="button" onClick={() => { setActiveSideItem(item.key); showToast(currentModule.label + " / " + item.label); }}><Icon name={item.icon} size={16} /><span className="side-text">{item.label}</span>{item.count ? <span className="mini-count">{item.count}</span> : null}</button>)}</div> : null}
        </div>
        <div className="sidebar-foot"><div className="storage-card"><div className="storage-line"><span>Project storage</span><b>38%</b></div><div className="progress"><span style={{ width: "38%" }} /></div><div className="meta-line storage-meta">3.8 GB / 10 GB • local + synced assets</div></div></div>
      </aside>

      <nav className="module-tabs" aria-label="Modules">
        {moduleTabs.map((module) => {
          const config = modules[module];
          return <button className={"module-tab" + (module === activeModule ? " active" : "")} data-view={module} key={module} type="button" onClick={() => activateModule(module)}><Icon name={config.icon} size={16} />{config.label}{config.count ? <span className="count-badge">{config.count}</span> : null}</button>;
        })}
      </nav>

      <main>{renderView()}</main>
      {toast ? <div className="toast show" role="status"><Icon name="check" size={15} /><span>{toast}</span></div> : null}
    </div>
  );
}
