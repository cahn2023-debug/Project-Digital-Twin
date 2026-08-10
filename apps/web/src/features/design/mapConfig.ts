import { apiBase } from "../../shared/api";
import type { BasemapLayerGroup, BasemapManifest, BasemapMode, BasemapSource } from "@project/domain";

export type BasemapKey = "street" | "hybrid" | "vector";
export type MapLayerKey =
  | "transport"
  | "roadLabels"
  | "administrative"
  | "places"
  | "placeLabels"
  | "landWater";

export type LayerVisibility = Record<MapLayerKey, boolean>;
export type MapLayerGroupConfig = BasemapLayerGroup & {
  key: MapLayerKey;
  matches: (layerId: string) => boolean;
};

export type ManifestLoadResult = {
  manifest: BasemapManifest;
  source: "server" | "cache" | "bundled";
  notice?: string;
};

export const googleStreetTiles = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
export const googleHybridTiles = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";
export const vectorStyleUrl = "https://tiles.openfreemap.org/styles/bright";

const manifestCacheKey = "pp-basemap-manifest-cache";
const manifestEtagKey = "pp-basemap-manifest-etag";
const manifestLastModifiedKey = "pp-basemap-manifest-last-modified";
const layerKeys: MapLayerKey[] = [
  "transport",
  "roadLabels",
  "administrative",
  "places",
  "placeLabels",
  "landWater",
];

export const defaultLayerVisibility: LayerVisibility = {
  transport: true,
  roadLabels: true,
  administrative: true,
  places: true,
  placeLabels: true,
  landWater: true,
};

const source = (
  kind: BasemapSource["kind"],
  provider: BasemapSource["provider"],
  layerControl: BasemapSource["layerControl"],
  tiles: string[],
  styleUrl: string | null,
  offline: BasemapSource["offline"],
): BasemapSource => ({
  kind,
  provider,
  layerControl,
  tiles,
  styleUrl,
  offline,
});

const googleOffline = { supported: false, kind: "none", glyphs: null, sprite: null } as const;
const osmOffline = {
  supported: true,
  kind: "vector-style",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
} as const;

export const bundledManifest: BasemapManifest = {
  schemaVersion: 2,
  manifestVersion: "bundled-2026-08-10.2",
  generatedAt: "2026-08-10T00:00:00Z",
  defaultMode: "vector",
  modes: {
    street: { key: "street", label: "Street", detail: "Google public roads · online", source: source("raster", "google", "baked-raster", [googleStreetTiles], null, googleOffline) },
    hybrid: { key: "hybrid", label: "Hybrid", detail: "Google public imagery · online", source: source("raster", "google", "baked-raster", [googleHybridTiles], null, googleOffline) },
    vector: { key: "vector", label: "Vector", detail: "OpenStreetMap · offline", source: source("style", "openstreetmap", "style-layer", ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf"], vectorStyleUrl, osmOffline) },
  },
  layers: [
    { key: "transport", label: "Đường & giao thông", detail: "Đường bộ, cầu, đường sắt", color: "#3b82f6", layerPrefixes: ["highway", "road_", "tunnel-", "bridge-", "railway", "ferry", "cablecar", "aeroway"], excludePrefixes: [], defaultVisibility: true },
    { key: "roadLabels", label: "Tên đường", detail: "Tên và mã tuyến đường", color: "#0f766e", layerPrefixes: ["highway-name", "road_shield", "highway-shield"], excludePrefixes: [], defaultVisibility: true },
    { key: "administrative", label: "Địa giới & hành chính", detail: "Biên giới, tỉnh/thành, quốc gia", color: "#a855f7", layerPrefixes: ["boundary", "label_state", "label_country"], excludePrefixes: [], defaultVisibility: true },
    { key: "places", label: "Địa điểm công cộng", detail: "POI, sân bay, điểm công cộng", color: "#f97316", layerPrefixes: ["poi", "airport"], excludePrefixes: [], defaultVisibility: true },
    { key: "placeLabels", label: "Tên địa danh", detail: "Thành phố, thị trấn, địa danh", color: "#be123c", layerPrefixes: ["label_"], excludePrefixes: ["label_state", "label_country"], defaultVisibility: true },
    { key: "landWater", label: "Đất, nước & công trình", detail: "Sông, hồ, đất phủ, tòa nhà", color: "#64748b", layerPrefixes: ["landcover", "landuse", "park", "water", "waterway", "building", "road_area", "road_pier", "highway-area"], excludePrefixes: [], defaultVisibility: true },
  ],
  attribution: ["© OpenStreetMap contributors", "© OpenFreeMap", "Google Maps tiles (online-only)", "MapLibre"],
  tilePackages: { supported: true, supportedModes: ["vector"], selection: "boundingBox", minZoom: 0, maxZoom: 18, storage: "desktop-local" },
};

export const basemapModes: Array<{ key: BasemapKey; label: string; detail: string }> = manifestModes(bundledManifest);
export const mapLayerGroups: MapLayerGroupConfig[] = layerGroupsFromManifest(bundledManifest);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isPublicUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isSource(value: unknown): value is BasemapSource {
  if (!isRecord(value) || (value.kind !== "raster" && value.kind !== "style") || (value.provider !== "google" && value.provider !== "openstreetmap") || (value.layerControl !== "baked-raster" && value.layerControl !== "style-layer")) return false;
  if (!Array.isArray(value.tiles) || !value.tiles.length || !value.tiles.every((tile) => isPublicUrl(tile) && tile.includes("{x}") && tile.includes("{y}") && tile.includes("{z}"))) return false;
  if (!isRecord(value.offline) || typeof value.offline.supported !== "boolean" || (value.offline.kind !== "none" && value.offline.kind !== "vector-style")) return false;
  if (value.offline.supported !== (value.offline.kind === "vector-style")) return false;
  if (value.offline.kind === "vector-style" && (!isPublicUrl(value.offline.glyphs) || !isPublicUrl(value.offline.sprite))) return false;
  if (value.offline.kind === "none" && (value.offline.glyphs !== null || value.offline.sprite !== null)) return false;
  if (value.provider === "google" && (value.kind !== "raster" || value.layerControl !== "baked-raster" || value.offline.supported)) return false;
  if (value.provider === "openstreetmap" && (value.kind !== "style" || value.layerControl !== "style-layer" || !value.offline.supported)) return false;
  return value.kind === "raster" ? value.styleUrl === null : isPublicUrl(value.styleUrl);
}

function isTilePackageCapabilities(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.supported === "boolean"
    && Array.isArray(value.supportedModes)
    && value.supportedModes.every((mode) => mode === "vector")
    && (value.supported ? value.supportedModes.length > 0 : value.supportedModes.length === 0)
    && value.selection === "boundingBox"
    && Number.isInteger(value.minZoom)
    && Number.isInteger(value.maxZoom)
    && (value.minZoom as number) >= 0
    && (value.maxZoom as number) <= 24
    && (value.maxZoom as number) >= (value.minZoom as number)
    && value.storage === "desktop-local";
}

export function validateBasemapManifest(value: unknown): value is BasemapManifest {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 2 || !isNonEmptyString(value.manifestVersion) || !isIsoTimestamp(value.generatedAt)) return false;
  if (!isRecord(value.modes) || !Array.isArray(value.layers) || !Array.isArray(value.attribution) || !isRecord(value.tilePackages)) return false;
  if (value.defaultMode !== "street" && value.defaultMode !== "hybrid" && value.defaultMode !== "vector") return false;
  if (!value.attribution.every((item) => isNonEmptyString(item)) || !isTilePackageCapabilities(value.tilePackages)) return false;
  if (Object.keys(value.modes).sort().join(",") !== "hybrid,street,vector") return false;
  for (const key of ["street", "hybrid", "vector"] as const) {
    const mode = value.modes[key];
    const expectedSourceKind = key === "vector" ? "style" : "raster";
    if (!isRecord(mode) || mode.key !== key || !isNonEmptyString(mode.label) || !isNonEmptyString(mode.detail) || !isSource(mode.source) || mode.source.kind !== expectedSourceKind) return false;
  }
  const layers = value.layers as unknown[];
  if (layers.length !== layerKeys.length) return false;
  for (const layer of layers) {
    if (!isRecord(layer) || !layerKeys.includes(layer.key as MapLayerKey)) return false;
    if (!isNonEmptyString(layer.label) || !isNonEmptyString(layer.detail) || !/^#[0-9A-Fa-f]{6}$/.test(String(layer.color)) || typeof layer.defaultVisibility !== "boolean" || !Array.isArray(layer.layerPrefixes) || !Array.isArray(layer.excludePrefixes)) return false;
    if (!layer.layerPrefixes.length || !layer.layerPrefixes.every((prefix) => isNonEmptyString(prefix)) || !layer.excludePrefixes.every((prefix) => isNonEmptyString(prefix))) return false;
  }
  return layerKeys.every((key) => layers.some((layer) => isRecord(layer) && layer.key === key));
}

export function manifestModes(manifest: BasemapManifest): Array<{ key: BasemapKey; label: string; detail: string }> {
  return (["street", "hybrid", "vector"] as const).map((key) => {
    const mode = manifest.modes[key] as BasemapMode;
    return { key, label: mode.label, detail: mode.detail };
  });
}

export function layerGroupsFromManifest(manifest: BasemapManifest): MapLayerGroupConfig[] {
  return manifest.layers.map((layer) => ({
    ...layer,
    key: layer.key as MapLayerKey,
    matches: (layerId: string) => layer.layerPrefixes.some((prefix) => layerId.startsWith(prefix)) && !layer.excludePrefixes.some((prefix) => layerId.startsWith(prefix)),
  }));
}

export function layerGroupMatchScore(group: MapLayerGroupConfig, layerId: string): number {
  const matchingPrefixes = group.layerPrefixes.filter((prefix) => layerId.startsWith(prefix) && !group.excludePrefixes.some((excluded) => layerId.startsWith(excluded)));
  return matchingPrefixes.reduce((score, prefix) => Math.max(score, prefix.length), -1);
}

export function defaultLayerVisibilityFromManifest(manifest: BasemapManifest): LayerVisibility {
  const visibility = { ...defaultLayerVisibility };
  for (const layer of manifest.layers) {
    const key = layer.key as MapLayerKey;
    if (layerKeys.includes(key)) visibility[key] = layer.defaultVisibility;
  }
  return visibility;
}

type CachedManifest = { manifest: BasemapManifest; etag?: string | null; lastModified?: string | null };

export function readCachedManifest(): BasemapManifest | null {
  return readCachedManifestRecord()?.manifest ?? null;
}

function readCachedManifestRecord(): CachedManifest | null {
  try {
    const raw = window.localStorage.getItem(manifestCacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedManifest;
    if (!validateBasemapManifest(parsed.manifest)) return null;
    return {
      manifest: parsed.manifest,
      etag: parsed.etag !== undefined ? parsed.etag : window.localStorage.getItem(manifestEtagKey),
      lastModified: parsed.lastModified !== undefined ? parsed.lastModified : window.localStorage.getItem(manifestLastModifiedKey),
    };
  } catch {
    return null;
  }
}

function cacheManifest(manifest: BasemapManifest, response: Response): void {
  const etag = response.headers.get("ETag");
  const lastModified = response.headers.get("Last-Modified");
  window.localStorage.setItem(manifestCacheKey, JSON.stringify({ manifest, etag, lastModified } satisfies CachedManifest));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 2500): Promise<{ response: Response; payload?: unknown }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status === 304) return { response };
    return { response, payload: await response.json() };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadBasemapManifest(): Promise<ManifestLoadResult> {
  const cached = readCachedManifestRecord();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

  try {
    const { response, payload } = await fetchWithTimeout(apiBase + "/api/v1/basemap/manifest", { headers });
    if (response.status === 304 && cached) return { manifest: cached.manifest, source: "cache" };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!validateBasemapManifest(payload)) throw new Error("Manifest không hợp lệ");
    cacheManifest(payload, response);
    return { manifest: payload, source: "server" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tải manifest";
    return {
      manifest: cached?.manifest ?? bundledManifest,
      source: cached ? "cache" : "bundled",
      notice: `Đang dùng manifest ${cached ? "last-known-good" : "bundled"}: ${message}`,
    };
  }
}

export function readBasemapPreference(defaultMode: BasemapKey = bundledManifest.defaultMode): BasemapKey {
  const saved = window.localStorage.getItem("pp-design-basemap");
  return saved === "street" || saved === "hybrid" || saved === "vector" ? saved : defaultMode;
}

export function readLayerPreferences(defaults: LayerVisibility = defaultLayerVisibility): LayerVisibility {
  const saved = window.localStorage.getItem("pp-design-map-layers");
  if (!saved) return defaults;
  try {
    const parsed = JSON.parse(saved) as Partial<LayerVisibility>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
