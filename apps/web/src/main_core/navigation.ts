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
    count: "17",
    sections: [
      { label: "Tá»•ng quan", icon: "grid", key: "overview" },
      { label: "Nguá»“n dá»¯ liá»‡u", icon: "file", key: "sources", count: "46" },
      { label: "Data Catalog", icon: "db", key: "catalog" },
      { label: "Camera Dataset", icon: "camera", key: "camera", count: "1,230" },
      { label: "Change Inbox", icon: "git", key: "changes", count: "17" },
      { label: "Data Quality", icon: "alert", key: "quality", count: "24" },
      { label: "File Versions", icon: "refresh", key: "versions" },
      { label: "Audit Trail", icon: "file", key: "audit" },
      { label: "Äá»“ng bá»™", icon: "refresh", key: "sync" },
    ],
  },
  design: {
    label: "DESIGN",
    icon: "map",
    sections: [
      { label: "Báº£n Ä‘á»“ thiáº¿t káº¿", icon: "map", key: "map" },
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
      { label: "Tá»•ng quan hiá»‡n trÆ°á»ng", icon: "grid", key: "overview" },
      { label: "Field Packages", icon: "box", key: "packages", count: "12" },
      { label: "Verification", icon: "check", key: "verification", count: "47" },
      { label: "Field Map", icon: "map", key: "map" },
      { label: "Pending Sync", icon: "refresh", key: "sync", count: "8" },
      { label: "Observations", icon: "eye", key: "observations" },
      { label: "Conflicts", icon: "alert", key: "conflicts", count: "3" },
      { label: "Thiáº¿t bá»‹ mobile", icon: "mobile", key: "devices", count: "4" },
    ],
  },
  organize: {
    label: "ORGANIZE",
    icon: "box",
    sections: [
      { label: "Tá»•ng quan", icon: "grid", key: "overview" },
      { label: "NhÃ  tháº§u", icon: "users", key: "contractors", count: "4" },
      { label: "Work Packages", icon: "box", key: "packages", count: "12" },
      { label: "PhÃ¢n cÃ´ng Entity", icon: "git", key: "assignment", count: "850" },
      { label: "Váº­t tÆ°", icon: "box", key: "materials", count: "Phase 2" },
      { label: "Giao nháº­n", icon: "file", key: "delivery", count: "Phase 2" },
      { label: "TrÃ¡ch nhiá»‡m & quyá»n", icon: "users", key: "permission" },
    ],
  },
  dashboard: {
    label: "DASHBOARD",
    icon: "chart",
    count: "4",
    sections: [
      { label: "Executive Summary", icon: "chart", key: "summary" },
      { label: "Tiáº¿n Ä‘á»™", icon: "chart", key: "progress" },
      { label: "NhÃ  tháº§u", icon: "users", key: "contractors" },
      { label: "Field Verification", icon: "check", key: "field" },
      { label: "Data Quality", icon: "db", key: "quality" },
      { label: "Cáº£nh bÃ¡o", icon: "alert", key: "alerts", count: "4" },
      { label: "Forecast", icon: "chart", key: "forecast" },
      { label: "BÃ¡o cÃ¡o", icon: "file", key: "reports" },
    ],
  },
};


export const moduleTabs: ModuleKey[] = ["datacenter", "design", "operate", "organize", "dashboard"];
