import type { IconName, ModuleKey } from "../shared/types";

export type SideItem = {
  label: string;
  icon: IconName;
  key: string;
  count?: string;
};

export type ModuleConfig = {
  label: string;
  icon: IconName;
  count?: string;
  sections: SideItem[];
};

export const modules: Record<ModuleKey, ModuleConfig> = {
  datacenter: {
    label: "DATACENTER",
    icon: "db",
    sections: [
      { label: "Tổng quan", icon: "grid", key: "overview" },
      { label: "Nguồn dữ liệu", icon: "file", key: "sources" },
      { label: "Data Catalog", icon: "db", key: "catalog" },
      { label: "Camera Dataset", icon: "camera", key: "camera" },
      { label: "Change Inbox", icon: "git", key: "changes" },
      { label: "Data Quality", icon: "alert", key: "quality" },
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
      { label: "Layers", icon: "grid", key: "layers" },
      { label: "Camera", icon: "camera", key: "camera" },
      { label: "Intersection", icon: "map", key: "intersection" },
      { label: "Design Revisions", icon: "git", key: "revisions" },
      { label: "Compare", icon: "eye", key: "compare" },
      { label: "Fiber Network", icon: "git", key: "fiber" },
    ],
  },
  operate: {
    label: "OPERATE",
    icon: "mobile",
    sections: [
      { label: "Tổng quan hiện trường", icon: "grid", key: "overview" },
      { label: "Field Packages", icon: "box", key: "packages" },
      { label: "Verification", icon: "check", key: "verification" },
      { label: "Field Map", icon: "map", key: "map" },
      { label: "Pending Sync", icon: "refresh", key: "sync" },
      { label: "Observations", icon: "eye", key: "observations" },
      { label: "Conflicts", icon: "alert", key: "conflicts" },
      { label: "Thiết bị mobile", icon: "mobile", key: "devices" },
    ],
  },
  organize: {
    label: "ORGANIZE",
    icon: "box",
    sections: [
      { label: "Tổng quan", icon: "grid", key: "overview" },
      { label: "Nhà thầu", icon: "users", key: "contractors" },
      { label: "Work Packages", icon: "box", key: "packages" },
      { label: "Phân công Entity", icon: "git", key: "assignment" },
      { label: "Vật tư", icon: "box", key: "materials" },
      { label: "Giao nhận", icon: "file", key: "delivery" },
      { label: "Trách nhiệm & quyền", icon: "users", key: "permission" },
    ],
  },
  dashboard: {
    label: "DASHBOARD",
    icon: "chart",
    sections: [
      { label: "Executive Summary", icon: "chart", key: "summary" },
      { label: "Tiến độ", icon: "chart", key: "progress" },
      { label: "Nhà thầu", icon: "users", key: "contractors" },
      { label: "Field Verification", icon: "check", key: "field" },
      { label: "Data Quality", icon: "db", key: "quality" },
      { label: "Cảnh báo", icon: "alert", key: "alerts" },
      { label: "Forecast", icon: "chart", key: "forecast" },
      { label: "Báo cáo", icon: "file", key: "reports" },
    ],
  },
};


export const moduleTabs: ModuleKey[] = ["datacenter", "design", "operate", "organize", "dashboard"];
