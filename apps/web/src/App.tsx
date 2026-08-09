import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Project, ProjectStatus } from "@project/domain";
import "maplibre-gl/dist/maplibre-gl.css";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

type ApiProject = {
  id: string;
  code: string;
  name: string;
  root_path: string;
  status: ProjectStatus;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

function toProject(project: ApiProject): Project {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    rootPath: project.root_path,
    status: project.status,
    schemaVersion: project.schema_version,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiBase + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body.detail === "string" ? body.detail : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return body as T;
}

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

type BasemapKey = "street" | "hybrid" | "vector";
type MapLayerKey =
  | "transport"
  | "roadLabels"
  | "administrative"
  | "places"
  | "placeLabels"
  | "landWater";

type LayerVisibility = Record<MapLayerKey, boolean>;

const basemapModes: Array<{ key: BasemapKey; label: string; detail: string }> = [
  { key: "street", label: "Street", detail: "Google public roads" },
  { key: "hybrid", label: "Hybrid", detail: "Google public imagery" },
  { key: "vector", label: "Vector", detail: "OpenStreetMap vector" },
];

const mapLayerGroups: Array<{
  key: MapLayerKey;
  label: string;
  detail: string;
  color: string;
  matches: (layerId: string) => boolean;
}> = [
  {
    key: "transport",
    label: "Đường & giao thông",
    detail: "Đường bộ, cầu, đường sắt",
    color: "#3b82f6",
    matches: (layerId) => /^(highway|road_|tunnel-|bridge-|railway|ferry|cablecar|aeroway)/.test(layerId),
  },
  {
    key: "roadLabels",
    label: "Tên đường",
    detail: "Tên và mã tuyến đường",
    color: "#0f766e",
    matches: (layerId) => /highway-name|road_shield|highway-shield/.test(layerId),
  },
  {
    key: "administrative",
    label: "Địa giới & hành chính",
    detail: "Biên giới, tỉnh/thành, quốc gia",
    color: "#a855f7",
    matches: (layerId) => layerId.startsWith("boundary") || /^(label_state|label_country)/.test(layerId),
  },
  {
    key: "places",
    label: "Địa điểm công cộng",
    detail: "POI, sân bay, điểm công cộng",
    color: "#f97316",
    matches: (layerId) => layerId.startsWith("poi") || layerId === "airport",
  },
  {
    key: "placeLabels",
    label: "Tên địa danh",
    detail: "Thành phố, thị trấn, địa danh",
    color: "#be123c",
    matches: (layerId) => layerId.startsWith("label_") && !/^(label_state|label_country)/.test(layerId),
  },
  {
    key: "landWater",
    label: "Đất, nước & công trình",
    detail: "Sông, hồ, đất phủ, tòa nhà",
    color: "#64748b",
    matches: (layerId) => /^(landcover|landuse|park|water|waterway|building|road_area|road_pier|highway-area)/.test(layerId),
  },
];

const defaultLayerVisibility: LayerVisibility = {
  transport: true,
  roadLabels: true,
  administrative: true,
  places: true,
  placeLabels: true,
  landWater: true,
};

const googleStreetTiles = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
const googleHybridTiles = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";
const vectorStyleUrl = "https://tiles.openfreemap.org/styles/bright";

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
      { label: "Audit Trail", icon: "file", key: "audit" },
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

function readBasemapPreference(): BasemapKey {
  const saved = window.localStorage.getItem("pp-design-basemap");
  return saved === "street" || saved === "hybrid" || saved === "vector" ? saved : "vector";
}

function readLayerPreferences(): LayerVisibility {
  const saved = window.localStorage.getItem("pp-design-map-layers");
  if (!saved) return defaultLayerVisibility;
  try {
    const parsed = JSON.parse(saved) as Partial<LayerVisibility>;
    return { ...defaultLayerVisibility, ...parsed };
  } catch {
    return defaultLayerVisibility;
  }
}

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

function ProjectDialog({
  busy,
  error,
  mode,
  name,
  onClose,
  onNameChange,
  onRootPathChange,
  onSubmit,
  project,
  rootPath,
}: {
  busy: boolean;
  error: string;
  mode: "create" | "delete";
  name: string;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onRootPathChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  project: Project | null;
  rootPath: string;
}) {
  const deleting = mode === "delete";
  return (
    <div className="project-modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <form className="project-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="project-modal-head">
          <div>
            <div className="panel-title">{deleting ? "Xóa project vĩnh viễn" : "Tạo project mới"}</div>
            <div className="panel-sub">
              {deleting ? "Dữ liệu hệ thống vẫn được giữ dưới dạng tombstone." : "Chọn một thư mục gốc đã tồn tại trên máy."}
            </div>
          </div>
          <button className="icon-btn" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        </div>
        {deleting ? (
          <div className="project-danger-note">
            Project <strong>{project?.name}</strong> sẽ bị loại khỏi workspace active. Thư mục gốc không bị xóa hoặc thay đổi.
          </div>
        ) : null}
        <label className="project-field">
          <span>{deleting ? "Nhập lại chính xác tên project" : "Tên project"}</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={deleting ? project?.name : "Ví dụ: Tuyến giao thông trung tâm"}
            aria-label={deleting ? "Xác nhận tên project" : "Tên project"}
          />
        </label>
        {!deleting ? (
          <label className="project-field">
            <span>Đường dẫn thư mục gốc</span>
            <input
              value={rootPath}
              onChange={(event) => onRootPathChange(event.target.value)}
              placeholder="Ví dụ: C:\\Projects\\DigitalTwin"
              aria-label="Đường dẫn thư mục gốc"
            />
            <small>Thư mục phải tồn tại và chưa được gắn với project khác.</small>
          </label>
        ) : null}
        {error ? <div className="project-form-error" role="alert">{error}</div> : null}
        <div className="project-modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={busy}>Hủy</button>
          <button className={"button " + (deleting ? "danger" : "primary")} type="submit" disabled={busy || !name.trim() || (!deleting && !rootPath.trim())}>
            {busy ? "Đang xử lý…" : deleting ? "Xóa vĩnh viễn" : "Tạo project"}
          </button>
        </div>
      </form>
    </div>
  );
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

function MapLibreMapView({
  layerVisibility,
  mode,
  onLayerToggle,
  onModeChange,
}: {
  layerVisibility: LayerVisibility;
  mode: BasemapKey;
  onLayerToggle: (key: MapLayerKey) => void;
  onModeChange: (mode: BasemapKey) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [googleMapUrl, setGoogleMapUrl] = useState("https://www.google.com/maps/@21.0285,105.8542,12z");

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: vectorStyleUrl,
      center: [105.8542, 21.0285],
      zoom: 11,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const updateGoogleMapUrl = () => {
      const center = map.getCenter();
      const zoom = Math.max(1, Math.round(map.getZoom()));
      setGoogleMapUrl(`https://www.google.com/maps/@${center.lat.toFixed(6)},${center.lng.toFixed(6)},${zoom}z`);
    };
    const handleMapError = (event: { error?: Error; sourceId?: string }) => {
      if (event.error) setMapError("Không tải được một phần nền bản đồ. Bạn có thể đổi chế độ nền.");
    };

    map.on("error", handleMapError);
    map.on("moveend", updateGoogleMapUrl);
    map.on("load", () => {
      const firstDataLayer = map.getStyle().layers?.find((layer: { id: string }) => layer.id !== "background")?.id;
      map.addSource("google-street", {
        type: "raster",
        tiles: [googleStreetTiles],
        tileSize: 256,
        attribution: "Google Maps",
      });
      map.addSource("google-hybrid", {
        type: "raster",
        tiles: [googleHybridTiles],
        tileSize: 256,
        attribution: "Google Maps",
      });
      map.addLayer(
        {
          id: "google-street-layer",
          type: "raster",
          source: "google-street",
          layout: { visibility: "none" },
          paint: { "raster-fade-duration": 0 },
        },
        firstDataLayer,
      );
      map.addLayer(
        {
          id: "google-hybrid-layer",
          type: "raster",
          source: "google-hybrid",
          layout: { visibility: "none" },
          paint: { "raster-fade-duration": 0 },
        },
        firstDataLayer,
      );
      setMapReady(true);
      updateGoogleMapUrl();
    });

    return () => {
      map.off("error", handleMapError);
      map.off("moveend", updateGoogleMapUrl);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const setVisibility = (layerId: string, visibility: "visible" | "none") => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
    };

    setVisibility("google-street-layer", mode === "street" ? "visible" : "none");
    setVisibility("google-hybrid-layer", mode === "hybrid" ? "visible" : "none");
    setVisibility("background", mode === "vector" ? "visible" : "none");

    for (const layer of map.getStyle().layers ?? []) {
      const group = mapLayerGroups.find((candidate) => candidate.matches(layer.id));
      if (group) setVisibility(layer.id, layerVisibility[group.key] ? "visible" : "none");
    }
  }, [layerVisibility, mapReady, mode]);

  return (
    <div className="map-panel maplibre-panel">
      <div ref={containerRef} className="map-canvas" aria-label="Bản đồ nền MapLibre của Việt Nam" />
      <div className="map-basemap-card">
        <div className="map-overlay-title">Nền bản đồ</div>
        <div className="map-basemap-options" role="group" aria-label="Chọn nền bản đồ">
          {basemapModes.map((basemap) => (
            <button
              className={"map-basemap-option" + (mode === basemap.key ? " active" : "")}
              key={basemap.key}
              onClick={() => onModeChange(basemap.key)}
              type="button"
              aria-pressed={mode === basemap.key}
            >
              <b>{basemap.label}</b>
              <span>{basemap.detail}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="map-layer-card">
        <div className="map-layer-head">
          <b className="map-layer-title">Lớp bản đồ</b>
          <span>{mode === "vector" ? "Vector" : "Overlay"}</span>
        </div>
        {mapLayerGroups.map((layer) => (
          <label className="layer-row" key={layer.key}>
            <span className="layer-swatch" style={{ background: layer.color }} />
            <span className="layer-copy"><b>{layer.label}</b><small>{layer.detail}</small></span>
            <input
              checked={layerVisibility[layer.key]}
              onChange={() => onLayerToggle(layer.key)}
              type="checkbox"
              aria-label={`Bật tắt ${layer.label}`}
            />
          </label>
        ))}
        <div className="map-layer-note">Layer được điều khiển trực tiếp bằng MapLibre.</div>
      </div>
      <a className="map-google-link" href={googleMapUrl} rel="noreferrer" target="_blank">
        Mở vị trí hiện tại trên Google Maps ↗
      </a>
      <div className="map-attribution">© OpenStreetMap contributors · Google Maps tiles (experimental) · MapLibre</div>
      {mapError ? <div className="map-error" role="status">{mapError}</div> : null}
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
  const [basemap, setBasemap] = useState<BasemapKey>(readBasemapPreference);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(readLayerPreferences);

  useEffect(() => {
    window.localStorage.setItem("pp-design-basemap", basemap);
  }, [basemap]);

  useEffect(() => {
    window.localStorage.setItem("pp-design-map-layers", JSON.stringify(layerVisibility));
  }, [layerVisibility]);

  const changeBasemap = (next: BasemapKey) => {
    setBasemap(next);
    onAction(`Đã chuyển nền bản đồ sang ${basemapModes.find((item) => item.key === next)?.label}`);
  };

  const toggleLayer = (key: MapLayerKey) => {
    setLayerVisibility((current) => ({ ...current, [key]: !current[key] }));
  };

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
        <Panel className="col-8" title="Bản đồ thiết kế" subtitle="EPSG:4326 • Nền MapLibre • Địa giới và địa danh Việt Nam" action={<div className="panel-actions"><Button onClick={() => onAction("Chế độ chỉnh sửa bản đồ đã bật")}><Icon name="edit" size={13} />Chỉnh sửa</Button><Button onClick={() => onAction("Layer nền bản đồ đang được điều khiển trực tiếp")}>Layers</Button></div>}>
          <MapLibreMapView
            layerVisibility={layerVisibility}
            mode={basemap}
            onLayerToggle={toggleLayer}
            onModeChange={changeBasemap}
          />
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

type OrganizeItemType = "ENTITY" | "SOURCE_FILE" | "IMPORT";
type OrganizeLifecycle = "ACTIVE" | "ARCHIVED" | "DELETED";

type OrganizeApiGroup = {
  id: string;
  project_id: string;
  name: string;
  parent_ids: string[];
  status: OrganizeLifecycle;
  created_at: string;
  updated_at: string;
};

type OrganizeApiTag = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};

type OrganizeApiItem = {
  type: OrganizeItemType;
  id: string;
  name: string;
  code: string | null;
  status: OrganizeLifecycle;
  group_ids: string[];
  tag_ids: string[];
  metadata: Record<string, unknown>;
  source: Record<string, unknown> | null;
  source_file_id: string | null;
  file_revision: number | null;
  source_path: string | null;
  import_status: string | null;
};

type OrganizeSnapshot = {
  groups: OrganizeApiGroup[];
  tags: OrganizeApiTag[];
  items: OrganizeApiItem[];
};

const emptyOrganizeSnapshot: OrganizeSnapshot = { groups: [], tags: [], items: [] };

function organizeItemKey(item: Pick<OrganizeApiItem, "type" | "id">) {
  return `${item.type}:${item.id}`;
}

function organizeTypeLabel(type: OrganizeItemType) {
  return type === "ENTITY" ? "Object" : type === "SOURCE_FILE" ? "Source file" : "Import";
}

function organizeStatusTone(status: OrganizeLifecycle): Tone {
  return status === "ACTIVE" ? "success" : status === "ARCHIVED" ? "warning" : "danger";
}

function formatOrganizeValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function OrganizeView({ onAction, projectId }: { onAction: (message: string) => void; projectId: string | null }) {
  const [snapshot, setSnapshot] = useState<OrganizeSnapshot>(emptyOrganizeSnapshot);
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState<OrganizeItemType | "ALL">("ALL");
  const [status, setStatus] = useState<OrganizeLifecycle | "ALL">("ACTIVE");
  const [groupFilterId, setGroupFilterId] = useState("");
  const [tagFilterId, setTagFilterId] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupParentId, setNewGroupParentId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [membershipGroupId, setMembershipGroupId] = useState("");
  const [membershipTagId, setMembershipTagId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionResults, setActionResults] = useState<Record<string, "success" | "error">>({});
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setSnapshot(emptyOrganizeSnapshot);
      setLoading(false);
      setError("");
      return () => { cancelled = true; };
    }

    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (itemType !== "ALL") params.set("item_type", itemType);
    if (status !== "ALL") params.set("status", status);
    if (groupFilterId) params.set("group_id", groupFilterId);
    if (tagFilterId) params.set("tag_id", tagFilterId);
    const suffix = params.toString() ? `?${params.toString()}` : "";

    setLoading(true);
    setError("");
    requestJson<OrganizeSnapshot>(`/api/v1/projects/${projectId}/organize${suffix}`)
      .then((nextSnapshot) => { if (!cancelled) setSnapshot(nextSnapshot); })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load Organize data"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [groupFilterId, itemType, projectId, query, reloadToken, status, tagFilterId]);

  const selectedItems = useMemo(
    () => snapshot.items.filter((item) => selectedKeys.includes(organizeItemKey(item))),
    [selectedKeys, snapshot.items],
  );
  const selectedItem = snapshot.items.find((item) => organizeItemKey(item) === selectedKey) ?? selectedItems[0] ?? null;
  const selectedType = selectedItems.length > 0 && selectedItems.every((item) => item.type === selectedItems[0].type) ? selectedItems[0].type : null;
  const allVisibleSelected = snapshot.items.length > 0 && snapshot.items.every((item) => selectedKeys.includes(organizeItemKey(item)));
  const groupsById = useMemo(() => new Map(snapshot.groups.map((group) => [group.id, group])), [snapshot.groups]);
  const tagsById = useMemo(() => new Map(snapshot.tags.map((tag) => [tag.id, tag])), [snapshot.tags]);
  const childrenByParent = useMemo(() => {
    const children = new Map<string, OrganizeApiGroup[]>();
    for (const group of snapshot.groups) {
      for (const parentId of group.parent_ids) children.set(parentId, [...(children.get(parentId) ?? []), group]);
    }
    for (const value of children.values()) value.sort((left, right) => left.name.localeCompare(right.name));
    return children;
  }, [snapshot.groups]);
  const rootGroups = useMemo(
    () => snapshot.groups.filter((group) => group.parent_ids.every((parentId) => !groupsById.has(parentId))).sort((left, right) => left.name.localeCompare(right.name)),
    [groupsById, snapshot.groups],
  );

  useEffect(() => {
    setSelectedKeys((current) => current.filter((key) => snapshot.items.some((item) => organizeItemKey(item) === key)));
    if (selectedKey && !snapshot.items.some((item) => organizeItemKey(item) === selectedKey)) setSelectedKey("");
  }, [selectedKey, snapshot.items]);

  const toggleSelection = (item: OrganizeApiItem) => {
    const key = organizeItemKey(item);
    setSelectedKey(key);
    setSelectedKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  };

  const selectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedKeys([]);
      setSelectedKey("");
      return;
    }
    setSelectedKeys(snapshot.items.map(organizeItemKey));
    if (snapshot.items[0]) setSelectedKey(organizeItemKey(snapshot.items[0]));
  };

  const runMutation = async (itemIds: string[], itemTypeForMutation: OrganizeItemType, body: Record<string, unknown>, successMessage: string) => {
    if (!projectId || itemIds.length === 0) return;
    setBusy(true);
    setError("");
    setActionMessage("");
    const keys = selectedItems.filter((item) => itemIds.includes(item.id)).map(organizeItemKey);
    const endpoint = body.operation === "lifecycle" ? "lifecycle" : "memberships";
    try {
      await requestJson<OrganizeSnapshot>(`/api/v1/projects/${projectId}/organize/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ item_type: itemTypeForMutation, item_ids: itemIds, ...body }),
      });
      setActionResults((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, "success" as const])) }));
      setActionMessage(successMessage);
      setReloadToken((value) => value + 1);
      onAction(successMessage);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Organize action failed";
      setActionResults((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, "error" as const])) }));
      setActionMessage(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const applyMembership = (operation: "add" | "remove") => {
    if (!selectedType) {
      setActionMessage(selectedItems.length > 1 ? "Select items of one type for a bulk action." : "Select at least one item.");
      return;
    }
    if (!membershipGroupId && !membershipTagId) {
      setActionMessage("Choose a group or tag first.");
      return;
    }
    void runMutation(selectedItems.map((item) => item.id), selectedType, {
      operation,
      group_ids: membershipGroupId ? [membershipGroupId] : [],
      tag_ids: membershipTagId ? [membershipTagId] : [],
    }, `${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} ${operation === "add" ? "classified" : "unlinked"}`);
  };

  const updateLifecycle = (nextStatus: "ACTIVE" | "ARCHIVED") => {
    if (!selectedType) {
      setActionMessage(selectedItems.length > 1 ? "Select items of one type for a bulk action." : "Select at least one item.");
      return;
    }
    void runMutation(selectedItems.map((item) => item.id), selectedType, { status: nextStatus, operation: "lifecycle" }, `${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} ${nextStatus === "ARCHIVED" ? "archived" : "restored"}`);
  };

  const createGroup = async () => {
    if (!projectId || !newGroupName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestJson<OrganizeApiGroup>(`/api/v1/projects/${projectId}/organize/groups`, { method: "POST", body: JSON.stringify({ name: newGroupName.trim(), parent_ids: newGroupParentId ? [newGroupParentId] : [] }) });
      setNewGroupName("");
      setActionMessage("Group created");
      setReloadToken((value) => value + 1);
      onAction("Group created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create group");
    } finally {
      setBusy(false);
    }
  };

  const createTag = async () => {
    if (!projectId || !newTagName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestJson<OrganizeApiTag>(`/api/v1/projects/${projectId}/organize/tags`, { method: "POST", body: JSON.stringify({ name: newTagName.trim() }) });
      setNewTagName("");
      setActionMessage("Tag created");
      setReloadToken((value) => value + 1);
      onAction("Tag created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create tag");
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedGroup = async () => {
    if (!projectId || !groupFilterId || !window.confirm("Delete this group and keep its data?")) return;
    setBusy(true);
    setError("");
    try {
      await requestJson<{ group_id: string; status: string }>(`/api/v1/projects/${projectId}/organize/groups/${groupFilterId}`, { method: "DELETE" });
      setGroupFilterId("");
      setNewGroupParentId("");
      setActionMessage("Group deleted; items were kept");
      setReloadToken((value) => value + 1);
      onAction("Group deleted; items were kept");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete group");
    } finally {
      setBusy(false);
    }
  };

  const renderGroup = (group: OrganizeApiGroup, path: string[]): ReactNode => {
    const nextPath = [...path, group.id];
    const children = (childrenByParent.get(group.id) ?? []).filter((child) => !nextPath.includes(child.id));
    const count = snapshot.items.filter((item) => item.group_ids.includes(group.id)).length;
    return <li key={`${group.id}-${path.join("/")}`} role="treeitem" aria-selected={groupFilterId === group.id}>
      <div className="organize-tree-row"><button className={"organize-tree-button" + (groupFilterId === group.id ? " active" : "")} type="button" aria-pressed={groupFilterId === group.id} onClick={() => setGroupFilterId(groupFilterId === group.id ? "" : group.id)}><Icon name="chevron" size={12} /><span>{group.name}</span><small>{count}</small></button></div>
      {children.length > 0 ? <ul role="group">{children.map((child) => renderGroup(child, nextPath))}</ul> : null}
    </li>;
  };

  return <div className="page">
    <PageHeader status={loading ? "Loading" : `${snapshot.items.length} items`} subtitle="Classify canonical objects, source files and imports with project-scoped groups, tags and reversible lifecycle actions." title="ORGANIZE" tone={error ? "danger" : "info"} actions={<Button onClick={() => setReloadToken((value) => value + 1)}><Icon name="refresh" size={14} />Refresh</Button>} />
    {error ? <div className="organize-alert" role="alert">{error}</div> : null}
    {actionMessage ? <div className="organize-result" role="status">{actionMessage}</div> : null}
    {!projectId ? <div className="organize-empty" role="status">Create or select an active project to organize data.</div> : null}
    {projectId ? <div className="grid-12 organize-layout">
      <Panel className="col-3" title="Groups" subtitle="Multi-parent tree"><div className="panel-body organize-tree-panel">
        <div className="organize-create-row"><input className="filter-input" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="New group name" aria-label="New group name" /><select className="select" value={newGroupParentId} onChange={(event) => setNewGroupParentId(event.target.value)} aria-label="Parent group"><option value="">Root group</option>{snapshot.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select><Button primary onClick={() => void createGroup()}>Add group</Button></div>
        {groupFilterId ? <div className="organize-tree-actions"><Button onClick={() => void deleteSelectedGroup()}>Delete group</Button><button className="text-button" type="button" onClick={() => setGroupFilterId("")}>Clear selection</button></div> : null}
        <ul className="organize-tree" role="tree" aria-label="Organize groups">{rootGroups.map((group) => renderGroup(group, []))}</ul>
        {snapshot.groups.length === 0 ? <div className="organize-muted">No groups yet.</div> : null}
        <div className="organize-tag-create"><label htmlFor="organize-new-tag">Tags</label><div className="organize-create-row"><input id="organize-new-tag" className="filter-input" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="New tag" aria-label="New tag name" /><Button onClick={() => void createTag()}>Add tag</Button></div></div>
        <div className="organize-tag-list" aria-label="Project tags">{snapshot.tags.map((tag) => <button className={"organize-tag-chip" + (tagFilterId === tag.id ? " active" : "")} type="button" key={tag.id} aria-pressed={tagFilterId === tag.id} onClick={() => setTagFilterId(tagFilterId === tag.id ? "" : tag.id)}>{tag.name}</button>)}{snapshot.tags.length === 0 ? <span className="organize-muted">No tags yet.</span> : null}</div>
      </div></Panel>

      <Panel className="col-5" title="Unified data" subtitle="Objects, source files and imports"><div className="panel-body organize-list-panel">
        <div className="organize-filter-grid"><label className="organize-field"><span>Search</span><input className="filter-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code, source..." aria-label="Search Organize data" /></label><label className="organize-field"><span>Type</span><select className="select" value={itemType} onChange={(event) => setItemType(event.target.value as OrganizeItemType | "ALL")} aria-label="Filter item type"><option value="ALL">All types</option><option value="ENTITY">Objects</option><option value="SOURCE_FILE">Source files</option><option value="IMPORT">Imports</option></select></label><label className="organize-field"><span>Lifecycle</span><select className="select" value={status} onChange={(event) => setStatus(event.target.value as OrganizeLifecycle | "ALL")} aria-label="Filter lifecycle"><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="DELETED">Trash</option><option value="ALL">All statuses</option></select></label></div>
        <div className="organize-selection-bar"><label><input checked={allVisibleSelected} onChange={selectAllVisible} type="checkbox" aria-label="Select all visible items" /> Select all</label><span>{selectedItems.length} selected</span>{selectedType ? <StatusBadge tone="info">{organizeTypeLabel(selectedType)}</StatusBadge> : selectedItems.length > 1 ? <StatusBadge tone="warning">Mixed types</StatusBadge> : null}</div>
        {loading ? <div className="organize-empty">Loading Organize data...</div> : null}
        {!loading && snapshot.items.length === 0 ? <div className="organize-empty">No items match the current filters.</div> : null}
        {!loading && snapshot.items.length > 0 ? <div className="organize-item-list" role="list" aria-label="Unified Organize items">{snapshot.items.map((item) => { const key = organizeItemKey(item); const result = actionResults[key]; return <div className={"organize-item-row" + (selectedKey === key ? " selected" : "")} key={key} role="listitem"><input checked={selectedKeys.includes(key)} onChange={() => toggleSelection(item)} type="checkbox" aria-label={`Select ${item.name}`} /><button className="organize-item-main" type="button" onClick={() => { setSelectedKey(key); setSelectedKeys((current) => current.includes(key) ? current : [...current, key]); }}><span className="organize-item-title"><strong>{item.name}</strong>{item.code ? <span className="mono">{item.code}</span> : null}</span><span className="organize-item-meta">{organizeTypeLabel(item.type)} {item.source_path ? `• ${item.source_path}` : "• No source path"}</span></button><StatusBadge tone={organizeStatusTone(item.status)}>{item.status}</StatusBadge>{result ? <span className={"organize-action-result " + result}>{result === "success" ? "Updated" : "Error"}</span> : null}</div>; })}</div> : null}
      </div></Panel>

      <Panel className="col-4" title="Details & actions" subtitle={selectedItem ? organizeTypeLabel(selectedItem.type) : "Select an item"}><div className="panel-body organize-detail-panel">
        {selectedItems.length > 0 ? <><div className="organize-action-grid"><select className="select" value={membershipGroupId} onChange={(event) => setMembershipGroupId(event.target.value)} aria-label="Group membership action"><option value="">Choose group</option>{snapshot.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select><select className="select" value={membershipTagId} onChange={(event) => setMembershipTagId(event.target.value)} aria-label="Tag membership action"><option value="">Choose tag</option>{snapshot.tags.map((tag) => <option value={tag.id} key={tag.id}>{tag.name}</option>)}</select><Button primary onClick={() => applyMembership("add")}>Assign</Button><Button onClick={() => applyMembership("remove")}>Unlink</Button><Button onClick={() => updateLifecycle("ARCHIVED")}>Archive</Button><Button onClick={() => updateLifecycle("ACTIVE")}>Restore</Button></div>{selectedItems.length > 1 && !selectedType ? <div className="organize-action-note">Bulk actions require items of the same type.</div> : null}</> : <div className="organize-empty">Select one or more items to manage groups, tags or lifecycle.</div>}
        {selectedItem ? <><div className="organize-detail-head"><div><div className="panel-title">{selectedItem.name}</div><div className="meta-line">{selectedItem.code ?? selectedItem.id}</div></div><StatusBadge tone={organizeStatusTone(selectedItem.status)}>{selectedItem.status}</StatusBadge></div><dl className="organize-properties"><div><dt>Type</dt><dd>{organizeTypeLabel(selectedItem.type)}</dd></div><div><dt>Source</dt><dd>{selectedItem.source_path ?? "Not linked"}</dd></div><div><dt>Revision</dt><dd>{selectedItem.file_revision ?? "—"}</dd></div><div><dt>Groups</dt><dd>{selectedItem.group_ids.map((id) => groupsById.get(id)?.name ?? id).join(", ") || "None"}</dd></div><div><dt>Tags</dt><dd>{selectedItem.tag_ids.map((id) => tagsById.get(id)?.name ?? id).join(", ") || "None"}</dd></div></dl><div className="organize-metadata"><div className="subsection-title">Metadata</div>{Object.entries(selectedItem.metadata).slice(0, 8).map(([key, value]) => <div className="organize-metadata-row" key={key}><span>{key}</span><strong>{formatOrganizeValue(value)}</strong></div>)}</div></> : null}
        {busy ? <div className="organize-muted" role="status">Saving...</div> : null}
      </div></Panel>
    </div> : null}
  </div>;
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

type AuditRow = {
  time: string;
  actor: string;
  operation: string;
  source: string;
  status: string;
  change: string;
};

const auditRows: AuditRow[] = [
  { time: "12:18:42", actor: "approver-1", operation: "FileImportApplied", source: "Camera.xlsx / CAMERA / 18", status: "APPLIED", change: "name: Base -> Main" },
  { time: "12:18:39", actor: "importer-1", operation: "FileImportSubmitted", source: "Camera.xlsx / CAMERA / 18", status: "PENDING_APPROVAL", change: "1 row + Raw" },
  { time: "12:16:04", actor: "software", operation: "FileWriteApplied", source: "Camera.xlsx / version 4", status: "APPLIED", change: "Status: DESIGNED -> AS_BUILT" },
  { time: "12:11:07", actor: "viewer-1", operation: "FileImportConflict", source: "Progress.xlsx / Sheet2 / 42", status: "CONFLICT", change: "name: base/server/local" },
];

function AuditView({ onAction }: { onAction: (message: string) => void }) {
  const [status, setStatus] = useState("all");
  const [actor, setActor] = useState("all");
  const filteredRows = useMemo(
    () => auditRows.filter((row) => (status === "all" || row.status === status) && (actor === "all" || row.actor === actor)),
    [actor, status],
  );
  return (
    <div className="page">
      <PageHeader
        status="Append-only"
        subtitle="Project-scoped lifecycle events with correlation chain and field before/after values."
        title="AUDIT TRAIL"
        tone="success"
        actions={<><Button onClick={() => onAction("Audit CSV export queued")}>Export CSV</Button><Button primary onClick={() => onAction("Audit filters refreshed")}>Refresh</Button></>}
      />
      <Panel title="Audit search" subtitle="Project 269 - detection to import to approval to write-back">
        <div className="panel-body">
          <div className="filter-row">
            <input className="filter-input" placeholder="Project / file / object / ChangeSet" aria-label="Search audit" />
            <select className="select" value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Filter actor">
              <option value="all">All actors</option><option value="approver-1">approver-1</option><option value="importer-1">importer-1</option><option value="software">software</option><option value="viewer-1">viewer-1</option>
            </select>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status">
              <option value="all">All statuses</option><option value="APPLIED">APPLIED</option><option value="PENDING_APPROVAL">PENDING_APPROVAL</option><option value="CONFLICT">CONFLICT</option>
            </select>
          </div>
        </div>
        <div className="panel-body flush table-wrap">
          <table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Operation</th><th>Source locator</th><th>Field before {"->"} after</th><th>Status</th></tr></thead><tbody>
            {filteredRows.map((row) => <tr key={row.time + row.operation}><td className="mono">{row.time}</td><td>{row.actor}</td><td className="mono">{row.operation}</td><td>{row.source}</td><td>{row.change}</td><td><StatusBadge tone={row.status === "CONFLICT" ? "danger" : row.status === "APPLIED" ? "success" : "warning"}>{row.status}</StatusBadge></td></tr>)}
          </tbody></table>
        </div>
      </Panel>
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<"active" | "archived">("active");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectDialog, setProjectDialog] = useState<"create" | "delete" | null>(null);
  const [projectDialogTarget, setProjectDialogTarget] = useState<Project | null>(null);
  const [projectDraftName, setProjectDraftName] = useState("");
  const [projectDraftRoot, setProjectDraftRoot] = useState("");
  const [projectError, setProjectError] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const currentProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;

  const refreshProjects = async (preferredId?: string): Promise<boolean> => {
    setProjectLoading(true);
    try {
      const [active, archived] = await Promise.all([
        requestJson<ApiProject[]>("/api/v1/projects?status=ACTIVE"),
        requestJson<ApiProject[]>("/api/v1/projects?status=ARCHIVED"),
      ]);
      const nextProjects = active.map(toProject);
      setProjects(nextProjects);
      setArchivedProjects(archived.map(toProject));
      setSelectedProjectId((previous) => {
        if (preferredId && nextProjects.some((project) => project.id === preferredId)) return preferredId;
        if (previous && nextProjects.some((project) => project.id === previous)) return previous;
        return nextProjects[0]?.id ?? null;
      });
      setProjectError("");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải danh sách project";
      setProjectError(message);
      setConnection({ label: "Projects offline", tone: "danger" });
      return false;
    } finally {
      setProjectLoading(false);
    }
  };

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
    void refreshProjects();
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

  const closeProjectDialog = () => {
    setProjectDialog(null);
    setProjectDialogTarget(null);
    setProjectDraftName("");
    setProjectDraftRoot("");
    setProjectError("");
  };

  const openCreateProject = () => {
    setProjectMenuOpen(false);
    setProjectDialog("create");
    setProjectDraftName("");
    setProjectDraftRoot("");
    setProjectError("");
  };

  const openDeleteProject = (project: Project) => {
    setProjectMenuOpen(false);
    setProjectDialog("delete");
    setProjectDialogTarget(project);
    setProjectDraftName("");
    setProjectError("");
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProjectBusy(true);
    setProjectError("");
    try {
      const created = await requestJson<ApiProject>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectDraftName.trim(), root_path: projectDraftRoot.trim() }),
      });
      if (!await refreshProjects(created.id)) throw new Error("Project đã tạo nhưng không thể tải lại danh sách");
      closeProjectDialog();
      showToast("Đã tạo và chọn project mới");
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể tạo project");
    } finally {
      setProjectBusy(false);
    }
  };

  const archiveProject = async (project: Project) => {
    setProjectBusy(true);
    setProjectError("");
    try {
      await requestJson<ApiProject>(`/api/v1/projects/${project.id}/archive`, { method: "POST" });
      if (!await refreshProjects()) throw new Error("Đã archive nhưng không thể tải lại danh sách project");
      showToast(`Đã archive ${project.name}`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể archive project");
    } finally {
      setProjectBusy(false);
    }
  };

  const restoreProject = async (project: Project) => {
    setProjectBusy(true);
    setProjectError("");
    try {
      const restored = await requestJson<ApiProject>(`/api/v1/projects/${project.id}/restore`, { method: "POST" });
      if (!await refreshProjects(restored.id)) throw new Error("Đã khôi phục nhưng không thể tải lại danh sách project");
      setProjectFilter("active");
      showToast(`Đã khôi phục ${project.name}`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể khôi phục project");
    } finally {
      setProjectBusy(false);
    }
  };

  const handleDeleteProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectDialogTarget) return;
    if (projectDraftName.trim() !== projectDialogTarget.name) {
      setProjectError("Tên xác nhận không khớp.");
      return;
    }
    setProjectBusy(true);
    setProjectError("");
    try {
      await requestJson<ApiProject>(`/api/v1/projects/${projectDialogTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ name: projectDraftName.trim() }),
      });
      if (!await refreshProjects()) throw new Error("Đã xóa nhưng không thể tải lại danh sách project");
      closeProjectDialog();
      showToast("Project đã được đánh dấu đã xóa; thư mục gốc được giữ nguyên");
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể xóa project");
    } finally {
      setProjectBusy(false);
    }
  };

  const activateModule = (module: ModuleKey) => {
    setActiveModule(module);
    setActiveSideItem(modules[module].sections[0].key);
  };

  const renderView = () => {
    if (activeModule === "datacenter") {
      if (activeSideItem === "audit") return <AuditView onAction={showToast} />;
      return <DatacenterView cameras={cameraRows} onAction={showToast} onSearchChange={setSearchQuery} searchQuery={searchQuery} />;
    }
    if (activeModule === "design") return <DesignView onAction={showToast} />;
    if (activeModule === "operate") return <OperateView onAction={showToast} />;
    if (activeModule === "organize") return <OrganizeView onAction={showToast} projectId={currentProject?.id ?? null} />;
    return <DashboardView onAction={showToast} />;
  };

  return (
    <div className={"app-shell" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Icon name="grid" size={19} /></div>
          <div><div className="brand-title">Project Platform</div><div className="brand-sub">Digital Twin Workspace</div></div>
        </div>
        <div className="project-switcher-shell">
          <button
            className="project-switcher"
            type="button"
            aria-expanded={projectMenuOpen}
            aria-haspopup="dialog"
            aria-label="Đổi project"
            onClick={() => setProjectMenuOpen(!projectMenuOpen)}
          >
            <div className="project-code">{currentProject?.code ?? "—"}</div>
            <div className="project-meta">
              <div className="project-name">{currentProject?.name ?? "Chưa có project active"}</div>
              <div className="project-line">
                <span><i className={"sync-dot " + connection.tone} />{connection.label}</span>
                <span>{currentProject ? currentProject.rootPath : "Tạo project để bắt đầu"}</span>
              </div>
            </div>
            <span className="project-chevron"><Icon name="chevron" size={16} /></span>
          </button>
          {projectMenuOpen ? (
            <div className="project-menu" role="dialog" aria-label="Project switcher">
              <div className="project-menu-head">
                <div><div className="panel-title">Projects</div><div className="panel-sub">Chọn workspace đang làm việc</div></div>
                <button className="button primary small" type="button" onClick={openCreateProject}><Icon name="plus" size={13} />Tạo</button>
              </div>
              <div className="project-menu-tabs" role="tablist" aria-label="Project filter">
                <button className={projectFilter === "active" ? "active" : ""} type="button" role="tab" aria-selected={projectFilter === "active"} onClick={() => setProjectFilter("active")}>Đang dùng ({projects.length})</button>
                <button className={projectFilter === "archived" ? "active" : ""} type="button" role="tab" aria-selected={projectFilter === "archived"} onClick={() => setProjectFilter("archived")}>Archived ({archivedProjects.length})</button>
              </div>
              {projectError ? <div className="project-menu-error" role="alert">{projectError}</div> : null}
              {projectLoading ? <div className="project-menu-empty">Đang tải project…</div> : null}
              {!projectLoading && (projectFilter === "active" ? projects : archivedProjects).length === 0 ? (
                <div className="project-menu-empty">{projectFilter === "active" ? "Chưa có project active." : "Không có project archived."}</div>
              ) : null}
              {!projectLoading ? (projectFilter === "active" ? projects : archivedProjects).map((project) => (
                <div className={"project-menu-item" + (project.id === currentProject?.id ? " selected" : "")} key={project.id}>
                  <button
                    className="project-menu-main"
                    type="button"
                    disabled={project.status !== "ACTIVE"}
                    onClick={() => { setSelectedProjectId(project.id); setProjectMenuOpen(false); }}
                  >
                    <span className="project-menu-code">{project.code}</span>
                    <span className="project-menu-copy"><strong>{project.name}</strong><small>{project.rootPath}</small></span>
                  </button>
                  <div className="project-menu-item-actions">
                    {project.status === "ACTIVE" ? (
                      <>
                        <button className="text-button" type="button" onClick={() => void archiveProject(project)} disabled={projectBusy}>Archive</button>
                        <button className="text-button danger-text" type="button" onClick={() => openDeleteProject(project)} disabled={projectBusy}>Xóa</button>
                      </>
                    ) : (
                      <button className="text-button" type="button" onClick={() => void restoreProject(project)} disabled={projectBusy}>Khôi phục</button>
                    )}
                  </div>
                </div>
              )) : null}
            </div>
          ) : null}
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
      {projectDialog ? (
        <ProjectDialog
          busy={projectBusy}
          error={projectError}
          mode={projectDialog}
          name={projectDraftName}
          onClose={closeProjectDialog}
          onNameChange={setProjectDraftName}
          onRootPathChange={setProjectDraftRoot}
          onSubmit={projectDialog === "create" ? handleCreateProject : handleDeleteProject}
          project={projectDialogTarget}
          rootPath={projectDraftRoot}
        />
      ) : null}
    </div>
  );
}
