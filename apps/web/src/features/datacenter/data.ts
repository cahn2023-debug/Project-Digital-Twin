import type { Tone } from "../../shared/types";

export const cameraRows = [
  ["CAM-001", "NG-031 Nguyễn Trãi", "10.32.1.21", "Designed", "Verified", "CameraMaster.xlsx", "18"],
  ["CAM-002", "NG-031 Nguyễn Trãi", "10.32.1.22", "Designed", "Pending", "CameraMaster.xlsx", "18"],
  ["CAM-114", "NG-044 Trần Duy Hưng", "10.44.2.14", "Designed", "Conflict", "CameraMaster.xlsx", "18"],
  ["CAM-215", "NG-078 Kim Mã", "10.78.1.15", "Designed", "Verified", "CameraMaster.xlsx", "18"],
  ["CAM-216", "NG-078 Kim Mã", "10.78.1.16", "Designed", "Not deployed", "CameraMaster.xlsx", "18"],
  ["CAM-398", "NG-102 Tây Sơn", "10.102.3.18", "Designed", "Verified", "CameraMaster.xlsx", "18"],
];

export const sourceRows = [
  { type: "XLSX", name: "CameraMaster.xlsx", meta: "MANAGED_FILE_MASTER • rev 18 • 2 phút trước", tone: "success" as Tone, state: "Synced" },
  { type: "SHP", name: "Intersection_269.shp", meta: "SOURCE_ONLY • rev 9 • 31 phút trước", tone: "success" as Tone, state: "Synced" },
  { type: "PDF", name: "BBNT_031.pdf", meta: "SOURCE_ONLY • local-only", tone: "warning" as Tone, state: "Local" },
  { type: "XLSX", name: "Contractor_A.xlsx", meta: "SOURCE_ONLY • rev 3 • hôm qua", tone: "success" as Tone, state: "Synced" },
];




