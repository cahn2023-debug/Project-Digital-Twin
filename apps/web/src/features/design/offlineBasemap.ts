import { addProtocol } from "maplibre-gl";
import type { BasemapSource } from "@project/domain";
import type { BasemapKey } from "./mapConfig";

export type OfflineBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type OfflineStyleJson = Record<string, unknown>;

export type OfflineTileSource = {
  sourceId: string;
  template: string;
  kind: "vector" | "raster";
  minZoom: number;
  maxZoom: number;
};

export type OfflineTilePackage = {
  id: string;
  format: "indexeddb-vector-style-v1";
  manifestVersion: string;
  mode: "vector";
  provider: "openstreetmap";
  sourceTemplates: string[];
  style: OfflineStyleJson;
  tileSources: OfflineTileSource[];
  bounds: OfflineBounds;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  downloadedTiles: number;
  assetCount: number;
  downloadedAssets: number;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
  status: "active";
};

type StoredPackage = Omit<OfflineTilePackage, "status"> & { status: "staging" | "active" | "archived" };
type StoredAsset = { key: string; packageId: string; path: string; kind: "tile" | "glyph" | "sprite"; data: ArrayBuffer };

export type TileDownloadProgress = {
  downloadedTiles: number;
  tileCount: number;
  downloadedAssets: number;
  assetCount: number;
  sizeBytes: number;
};

export type TileDownloadOptions = {
  mode: "vector";
  manifestVersion: string;
  source: BasemapSource;
  bounds: OfflineBounds;
  minZoom: number;
  maxZoom: number;
  zoomLimits?: { min: number; max: number };
  signal?: AbortSignal;
  onProgress?: (progress: TileDownloadProgress) => void;
};

export const offlineProtocol = "pp-offline";
export const maxOfflineTiles = 5_000;

const databaseName = "pp-basemap-tiles";
const databaseVersion = 2;
const packageStore = "packages";
const assetStore = "tiles";
const glyphRanges = Array.from({ length: 32 }, (_, index) => `${index * 256}-${index * 256 + 255}`);
let databasePromise: Promise<IDBDatabase> | null = null;
let protocolRegistered = false;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  const pending: Promise<IDBDatabase> = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Thiết bị không hỗ trợ lưu tile offline"));
      return;
    }
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(packageStore)) database.createObjectStore(packageStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(assetStore)) database.createObjectStore(assetStore, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không thể mở kho tile offline"));
  });
  databasePromise = pending;
  void pending.catch(() => {
    databasePromise = null;
  });
  return pending;
}

function clampLatitude(latitude: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function tileX(longitude: number, zoom: number): number {
  const size = 2 ** zoom;
  return Math.floor(((longitude + 180) / 360) * size);
}

function tileY(latitude: number, zoom: number): number {
  const radians = (clampLatitude(latitude) * Math.PI) / 180;
  const size = 2 ** zoom;
  return Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * size);
}

function tileEnd(value: number, zoom: number, axis: "x" | "y"): number {
  const size = 2 ** zoom;
  const raw = axis === "x" ? ((value + 180) / 360) * size : ((1 - Math.asinh(Math.tan((clampLatitude(value) * Math.PI) / 180)) / Math.PI) / 2) * size;
  return Math.max(0, Math.min(size - 1, Math.ceil(raw) - 1));
}

export function tilesForBounds(bounds: OfflineBounds, minZoom: number, maxZoom: number): Array<[z: number, x: number, y: number]> {
  const tiles: Array<[number, number, number]> = [];
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const size = 2 ** z;
    const firstX = Math.max(0, Math.min(size - 1, tileX(bounds.west, z)));
    const lastX = tileEnd(bounds.east, z, "x");
    const firstY = Math.max(0, Math.min(size - 1, tileY(bounds.north, z)));
    const lastY = tileEnd(bounds.south, z, "y");
    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) tiles.push([z, x, y]);
    }
  }
  return tiles;
}

export function validateOfflineSelection(bounds: OfflineBounds, minZoom: number, maxZoom: number, zoomLimits = { min: 0, max: 24 }): string | null {
  if (![bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite)) return "Vùng tải tile không hợp lệ.";
  if (bounds.west >= bounds.east || bounds.south >= bounds.north) return "Kinh độ/tọa độ vùng tải phải có chiều rộng và chiều cao lớn hơn 0.";
  if (bounds.west < -180 || bounds.east > 180 || bounds.south < -85.05112878 || bounds.north > 85.05112878) return "Vùng tải nằm ngoài phạm vi Web Mercator.";
  if (!Number.isInteger(minZoom) || !Number.isInteger(maxZoom) || minZoom < 0 || maxZoom > 24 || minZoom > maxZoom) return "Dải zoom không hợp lệ.";
  if (minZoom < zoomLimits.min || maxZoom > zoomLimits.max) return `Zoom phải nằm trong khoảng ${zoomLimits.min}–${zoomLimits.max}.`;
  let tileCount = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const size = 2 ** z;
    const firstX = Math.max(0, Math.min(size - 1, tileX(bounds.west, z)));
    const lastX = tileEnd(bounds.east, z, "x");
    const firstY = Math.max(0, Math.min(size - 1, tileY(bounds.north, z)));
    const lastY = tileEnd(bounds.south, z, "y");
    tileCount += (lastX - firstX + 1) * (lastY - firstY + 1);
    if (tileCount > maxOfflineTiles) break;
  }
  return tileCount > maxOfflineTiles ? `Vùng/zoom tạo ${tileCount.toLocaleString("vi-VN")} tile, vượt giới hạn ${maxOfflineTiles.toLocaleString("vi-VN")}.` : null;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: ArrayBuffer | Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Thiết bị không hỗ trợ checksum tile offline");
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return bytesToHex(await globalThis.crypto.subtle.digest("SHA-256", copy.buffer));
}

function packageAssetKey(packageId: string, path: string): string {
  return `${packageId}/${path}`;
}

function offlineAssetUrl(packageId: string, path: string): string {
  return `${offlineProtocol}://${encodeURIComponent(packageId)}/${path}`;
}

function templateUrl(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce((url, [key, value]) => url.replaceAll(`{${key}}`, value), template);
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<OfflineStyleJson> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Không tải được style OSM (${response.status}).`);
  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Style OSM không hợp lệ.");
  return payload as OfflineStyleJson;
}

async function fetchAsset(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Không tải được asset nền OSM (${response.status}).`);
  return response.arrayBuffer();
}

function cloneStyle(style: OfflineStyleJson): OfflineStyleJson {
  return JSON.parse(JSON.stringify(style)) as OfflineStyleJson;
}

function containsProjectData(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsProjectData(item));
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => ["projects", "entities", "cameras", "projectData"].includes(key) || containsProjectData(child));
}

function collectFontstacks(style: OfflineStyleJson): string[] {
  const fonts = new Set<string>();
  const layers = Array.isArray(style.layers) ? style.layers : [];
  for (const layer of layers) {
    if (!layer || typeof layer !== "object" || Array.isArray(layer)) continue;
    const layout = (layer as Record<string, unknown>).layout;
    if (!layout || typeof layout !== "object" || Array.isArray(layout)) continue;
    const textFont = (layout as Record<string, unknown>)["text-font"];
    if (typeof textFont === "string") fonts.add(textFont);
    if (Array.isArray(textFont)) textFont.filter((font): font is string => typeof font === "string").forEach((font) => fonts.add(font));
  }
  return [...fonts];
}

function mapStyleSources(style: OfflineStyleJson, source: BasemapSource, packageId: string): OfflineTileSource[] {
  const sources = style.sources;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) throw new Error("Style OSM không khai báo source.");
  const tileSources: OfflineTileSource[] = [];
  for (const [sourceId, rawSource] of Object.entries(sources as Record<string, unknown>)) {
    if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) throw new Error("Style OSM có source không hợp lệ.");
    const sourceRecord = rawSource as Record<string, unknown>;
    const kind = sourceRecord.type === "vector" ? "vector" : sourceRecord.type === "raster" ? "raster" : null;
    if (!kind) continue;
    const onlineTemplates = kind === "vector"
      ? source.tiles
        ? (Array.isArray(source.tiles) ? source.tiles : [])
        : sourceRecord.url
          ? source.tiles
          : []
      : Array.isArray(sourceRecord.tiles) ? sourceRecord.tiles : [];
    const templates = (onlineTemplates.length ? onlineTemplates : kind === "vector" ? source.tiles : []).filter((template): template is string => typeof template === "string");
    if (!templates.length) throw new Error(`Style OSM source ${sourceId} không có tile template trực tiếp.`);
    delete sourceRecord.url;
    sourceRecord.tiles = templates.map((template) => {
      const sourceIndex = tileSources.length;
      const sourceMinZoom = kind === "raster" ? 0 : 0;
      const sourceMaxZoom = kind === "raster" && typeof sourceRecord.maxzoom === "number" ? Math.min(18, sourceRecord.maxzoom) : 24;
      tileSources.push({ sourceId, template, kind, minZoom: sourceMinZoom, maxZoom: sourceMaxZoom });
      return offlineAssetUrl(packageId, `tile/${sourceIndex}/{z}/{x}/{y}`);
    });
  }
  return tileSources;
}

async function putPackage(database: IDBDatabase, value: StoredPackage): Promise<void> {
  const transaction = database.transaction(packageStore, "readwrite");
  transaction.objectStore(packageStore).put(value);
  await transactionComplete(transaction);
}

async function putAsset(database: IDBDatabase, value: StoredAsset): Promise<void> {
  const transaction = database.transaction(assetStore, "readwrite");
  transaction.objectStore(assetStore).put(value);
  await transactionComplete(transaction);
}

async function deletePackage(database: IDBDatabase, packageId: string): Promise<void> {
  const readTransaction = database.transaction(assetStore, "readonly");
  const readDone = transactionComplete(readTransaction);
  const assets = (await requestResult(readTransaction.objectStore(assetStore).getAll())) as StoredAsset[];
  await readDone;
  const transaction = database.transaction([packageStore, assetStore], "readwrite");
  transaction.objectStore(packageStore).delete(packageId);
  for (const asset of assets) if (asset.packageId === packageId) transaction.objectStore(assetStore).delete(asset.key);
  await transactionComplete(transaction);
}

async function activatePackage(database: IDBDatabase, packageToActivate: StoredPackage): Promise<void> {
  const readTransaction = database.transaction(packageStore, "readonly");
  const readDone = transactionComplete(readTransaction);
  const packages = (await requestResult(readTransaction.objectStore(packageStore).getAll())) as StoredPackage[];
  await readDone;
  const transaction = database.transaction(packageStore, "readwrite");
  const store = transaction.objectStore(packageStore);
  for (const item of packages) if (item.mode === "vector" && item.status === "active") store.put({ ...item, status: "archived" });
  store.put({ ...packageToActivate, status: "active" });
  await transactionComplete(transaction);
}

async function readAssets(database: IDBDatabase, packageId: string): Promise<StoredAsset[]> {
  const transaction = database.transaction(assetStore, "readonly");
  const done = transactionComplete(transaction);
  const assets = (await requestResult(transaction.objectStore(assetStore).getAll())) as StoredAsset[];
  await done;
  return assets.filter((asset) => asset.packageId === packageId);
}

async function readAsset(database: IDBDatabase, packageId: string, path: string): Promise<ArrayBuffer | null> {
  const transaction = database.transaction(assetStore, "readonly");
  const done = transactionComplete(transaction);
  const asset = (await requestResult(transaction.objectStore(assetStore).get(packageAssetKey(packageId, path)))) as StoredAsset | undefined;
  await done;
  return asset?.data ?? null;
}

async function packageChecksum(style: OfflineStyleJson, assets: StoredAsset[]): Promise<string> {
  const entries = [`style:${await sha256(new TextEncoder().encode(JSON.stringify(style)))}`];
  for (const asset of assets.sort((left, right) => left.path.localeCompare(right.path))) entries.push(`${asset.path}:${await sha256(asset.data)}`);
  return sha256(new TextEncoder().encode(entries.join("|")));
}

async function verifyPackage(database: IDBDatabase, packageToVerify: OfflineTilePackage): Promise<boolean> {
  if (packageToVerify.downloadedAssets !== packageToVerify.assetCount || packageToVerify.downloadedTiles !== packageToVerify.tileCount || !packageToVerify.style) return false;
  const assets = await readAssets(database, packageToVerify.id);
  if (assets.length !== packageToVerify.assetCount - 1) return false;
  return await packageChecksum(packageToVerify.style, assets) === packageToVerify.checksum;
}

async function archivePackage(database: IDBDatabase, packageToArchive: OfflineTilePackage): Promise<void> {
  const transaction = database.transaction(packageStore, "readwrite");
  transaction.objectStore(packageStore).put({ ...packageToArchive, status: "archived" } satisfies StoredPackage);
  await transactionComplete(transaction);
}

export async function listOfflinePackages(): Promise<OfflineTilePackage[]> {
  const database = await openDatabase();
  const transaction = database.transaction(packageStore, "readonly");
  const done = transactionComplete(transaction);
  const packages = (await requestResult(transaction.objectStore(packageStore).getAll())) as StoredPackage[];
  await done;
  for (const item of packages.filter((candidate) => candidate.status === "staging" && Date.now() - Date.parse(candidate.updatedAt) > 60 * 60 * 1000)) await deletePackage(database, item.id);
  const validPackages: OfflineTilePackage[] = [];
  for (const item of packages.filter((candidate) => candidate.status === "active" && candidate.format === "indexeddb-vector-style-v1" && candidate.mode === "vector")) {
    const packageToCheck = item as OfflineTilePackage;
    if (await verifyPackage(database, packageToCheck)) validPackages.push(packageToCheck);
    else await archivePackage(database, packageToCheck);
  }
  return validPackages;
}

export async function getActiveOfflinePackage(manifestVersion: string, sourceTemplates: string[]): Promise<OfflineTilePackage | null> {
  const packages = await listOfflinePackages();
  return packages
    .filter((item) => item.manifestVersion === manifestVersion && item.provider === "openstreetmap" && item.sourceTemplates.length === sourceTemplates.length && item.sourceTemplates.every((template, index) => template === sourceTemplates[index]))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export function packageCoversPoint(packageToCheck: OfflineTilePackage, longitude: number, latitude: number): boolean {
  return longitude >= packageToCheck.bounds.west && longitude <= packageToCheck.bounds.east && latitude >= packageToCheck.bounds.south && latitude <= packageToCheck.bounds.north;
}

export function packageCoversViewport(packageToCheck: OfflineTilePackage, viewport: OfflineBounds): boolean {
  return viewport.west >= packageToCheck.bounds.west
    && viewport.east <= packageToCheck.bounds.east
    && viewport.south >= packageToCheck.bounds.south
    && viewport.north <= packageToCheck.bounds.north;
}

export async function downloadTilePackage(options: TileDownloadOptions): Promise<OfflineTilePackage> {
  const { bounds, maxZoom, minZoom, mode, manifestVersion, source, signal, onProgress, zoomLimits } = options;
  const selectionError = validateOfflineSelection(bounds, minZoom, maxZoom, zoomLimits);
  if (selectionError) throw new Error(selectionError);
  if (mode !== "vector" || source.provider !== "openstreetmap" || source.kind !== "style" || !source.offline.supported || !source.styleUrl) throw new Error("Chỉ OSM Vector được phép tạo package offline.");
  if (!source.tiles.length || source.tiles.some((template) => !template.includes("{z}") || !template.includes("{x}") || !template.includes("{y}"))) throw new Error("Manifest không cung cấp vector tile source hợp lệ cho OSM.");

  const onlineStyle = await fetchJson(source.styleUrl, signal);
  const style = cloneStyle(onlineStyle);
  if (containsProjectData(style)) throw new Error("Style nền không được chứa dữ liệu dự án.");
  const packageId = `vector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tileSources = mapStyleSources(style, source, packageId);
  const glyphTemplate = typeof style.glyphs === "string" ? style.glyphs : source.offline.glyphs;
  const spriteTemplate = typeof style.sprite === "string" ? style.sprite : source.offline.sprite;
  const fontstacks = glyphTemplate ? collectFontstacks(style) : [];
  if (glyphTemplate && !fontstacks.length) fontstacks.push("Noto Sans Regular");
  if (glyphTemplate) style.glyphs = offlineAssetUrl(packageId, "glyphs/{fontstack}/{range}.pbf");
  if (spriteTemplate) style.sprite = offlineAssetUrl(packageId, "sprite");

  const tileCoordinates = tileSources.flatMap((tileSource) => {
    const sourceMinZoom = tileSource.kind === "raster" ? tileSource.minZoom : minZoom;
    const sourceMaxZoom = tileSource.kind === "raster" ? Math.min(maxZoom, tileSource.maxZoom) : maxZoom;
    return sourceMaxZoom >= sourceMinZoom ? tilesForBounds(bounds, sourceMinZoom, sourceMaxZoom).map(([z, x, y]) => ({ tileSource, z, x, y })) : [];
  });
  const spriteCount = spriteTemplate ? 2 : 0;
  const glyphCount = glyphTemplate ? fontstacks.length * glyphRanges.length : 0;
  const tileCount = tileCoordinates.length;
  if (tileCount > maxOfflineTiles) throw new Error(`Package tạo ${tileCount.toLocaleString("vi-VN")} tile, vượt giới hạn ${maxOfflineTiles.toLocaleString("vi-VN")}.`);
  const assetCount = 1 + tileCount + glyphCount + spriteCount;
  const now = new Date().toISOString();
  const database = await openDatabase();
  const staged: StoredPackage = {
    id: packageId,
    format: "indexeddb-vector-style-v1",
    manifestVersion,
    mode,
    provider: "openstreetmap",
    sourceTemplates: source.tiles,
    style,
    tileSources,
    bounds,
    minZoom,
    maxZoom,
    tileCount,
    downloadedTiles: 0,
    assetCount,
    downloadedAssets: 1,
    sizeBytes: 0,
    checksum: "",
    createdAt: now,
    updatedAt: now,
    status: "staging",
  };
  await putPackage(database, staged);
  const downloadedAssets: StoredAsset[] = [];
  let downloadedTiles = 0;
  let sizeBytes = 0;
  const report = () => onProgress?.({ downloadedTiles, tileCount, downloadedAssets: downloadedAssets.length + 1, assetCount, sizeBytes });
  report();

  try {
    for (const { tileSource, z, x, y } of tileCoordinates) {
      if (signal?.aborted) throw new DOMException("Tile download canceled", "AbortError");
      const data = await fetchAsset(templateUrl(tileSource.template, { z: String(z), x: String(x), y: String(y) }), signal);
      const path = `tile/${tileSources.indexOf(tileSource)}/${z}/${x}/${y}`;
      const asset: StoredAsset = { key: packageAssetKey(packageId, path), packageId, path, kind: "tile", data };
      await putAsset(database, asset);
      downloadedAssets.push(asset);
      downloadedTiles += 1;
      sizeBytes += data.byteLength;
      await putPackage(database, { ...staged, downloadedTiles, downloadedAssets: downloadedAssets.length + 1, sizeBytes, updatedAt: new Date().toISOString() });
      report();
    }
    if (glyphTemplate) {
      for (const fontstack of fontstacks) {
        for (const range of glyphRanges) {
          if (signal?.aborted) throw new DOMException("Tile download canceled", "AbortError");
          const data = await fetchAsset(templateUrl(glyphTemplate, { fontstack: encodeURIComponent(fontstack), range }), signal);
          const path = `glyphs/${fontstack}/${range}.pbf`;
          const asset: StoredAsset = { key: packageAssetKey(packageId, path), packageId, path, kind: "glyph", data };
          await putAsset(database, asset);
          downloadedAssets.push(asset);
          sizeBytes += data.byteLength;
          await putPackage(database, { ...staged, downloadedTiles, downloadedAssets: downloadedAssets.length + 1, sizeBytes, updatedAt: new Date().toISOString() });
          report();
        }
      }
    }
    if (spriteTemplate) {
      for (const extension of ["json", "png"] as const) {
        if (signal?.aborted) throw new DOMException("Tile download canceled", "AbortError");
        const data = await fetchAsset(`${spriteTemplate}.${extension}`, signal);
        const path = `sprite.${extension}`;
        const asset: StoredAsset = { key: packageAssetKey(packageId, path), packageId, path, kind: "sprite", data };
        await putAsset(database, asset);
        downloadedAssets.push(asset);
        sizeBytes += data.byteLength;
        await putPackage(database, { ...staged, downloadedTiles, downloadedAssets: downloadedAssets.length + 1, sizeBytes, updatedAt: new Date().toISOString() });
        report();
      }
    }
    const checksum = await packageChecksum(style, downloadedAssets);
    const completed: OfflineTilePackage = { ...staged, downloadedAssets: assetCount, downloadedTiles, sizeBytes, checksum, updatedAt: new Date().toISOString(), status: "active" };
    await activatePackage(database, completed);
    return completed;
  } catch (error) {
    await deletePackage(database, packageId).catch(() => undefined);
    throw error;
  }
}

async function loadOfflineAsset(request: { url: string }, abortController: AbortController): Promise<{ data: ArrayBuffer }> {
  const match = new RegExp(`^${offlineProtocol}://([^/]+)/(.*)$`).exec(request.url.split("?")[0]);
  if (!match) throw new Error("Offline asset URL không hợp lệ.");
  if (abortController.signal.aborted) throw new DOMException("Offline asset request canceled", "AbortError");
  const packageId = decodeURIComponent(match[1]);
  const path = decodeURIComponent(match[2]);
  const database = await openDatabase();
  const data = await readAsset(database, packageId, path);
  if (!data) throw new Error("Asset nền OSM nằm ngoài package offline.");
  return { data };
}

export function ensureOfflineBasemapProtocol(): void {
  if (protocolRegistered) return;
  addProtocol(offlineProtocol, loadOfflineAsset);
  protocolRegistered = true;
}
