export type BasemapKey = "street" | "hybrid" | "vector";
export type MapLayerKey =
  | "transport"
  | "roadLabels"
  | "administrative"
  | "places"
  | "placeLabels"
  | "landWater";

export type LayerVisibility = Record<MapLayerKey, boolean>;

export const basemapModes: Array<{ key: BasemapKey; label: string; detail: string }> = [
  { key: "street", label: "Street", detail: "Google public roads" },
  { key: "hybrid", label: "Hybrid", detail: "Google public imagery" },
  { key: "vector", label: "Vector", detail: "OpenStreetMap vector" },
];

export const mapLayerGroups: Array<{
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

export const defaultLayerVisibility: LayerVisibility = {
  transport: true,
  roadLabels: true,
  administrative: true,
  places: true,
  placeLabels: true,
  landWater: true,
};

export const googleStreetTiles = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
export const googleHybridTiles = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";
export const vectorStyleUrl = "https://tiles.openfreemap.org/styles/bright";

export function readBasemapPreference(): BasemapKey {
  const saved = window.localStorage.getItem("pp-design-basemap");
  return saved === "street" || saved === "hybrid" || saved === "vector" ? saved : "vector";
}

export function readLayerPreferences(): LayerVisibility {
  const saved = window.localStorage.getItem("pp-design-map-layers");
  if (!saved) return defaultLayerVisibility;
  try {
    const parsed = JSON.parse(saved) as Partial<LayerVisibility>;
    return { ...defaultLayerVisibility, ...parsed };
  } catch {
    return defaultLayerVisibility;
  }
}


