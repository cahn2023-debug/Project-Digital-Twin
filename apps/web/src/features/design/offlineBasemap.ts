import { addProtocol } from "maplibre-gl";
import type { BasemapKey } from "./mapConfig";

export type OfflineBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type OfflineTilePackage = {
  id: string;
  format: "indexeddb-raster-tiles-v1";
  manifestVersion: string;
  mode: Extract<BasemapKey, "street" | "hybrid">;
  sourceTemplates: string[];
  bounds: OfflineBounds;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  downloadedTiles: number;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
  status: "active";
};

type StoredPackage = Omit<OfflineTilePackage, "status"> & { status: "staging" | "active" | "archived" };
type StoredTile = { key: string; packageId: string; sourceIndex: number; z: number; x: number; y: number; data: ArrayBuffer };

export type TileDownloadProgress = {
  downloadedTiles: number;
  tileCount: number;
  sizeBytes: number;
};

export type TileDownloadOptions = {
  mode: Extract<BasemapKey, "street" | "hybrid">;
  manifestVersion: string;
  sourceTemplates: string[];
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
const databaseVersion = 1;
const packageStore = "packages";
const tileStore = "tiles";
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
      if (!database.objectStoreNames.contains(tileStore)) database.createObjectStore(tileStore, { keyPath: "key" });
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

function tileKey(packageId: string, sourceIndex: number, z: number, x: number, y: number): string {
  return `${packageId}/${sourceIndex}/${z}/${x}/${y}`;
}

function templateUrl(template: string, z: number, x: number, y: number): string {
  return template.replaceAll("{z}", String(z)).replaceAll("{x}", String(x)).replaceAll("{y}", String(y));
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

async function putPackage(database: IDBDatabase, value: StoredPackage): Promise<void> {
  const transaction = database.transaction(packageStore, "readwrite");
  transaction.objectStore(packageStore).put(value);
  await transactionComplete(transaction);
}

async function putTile(database: IDBDatabase, value: StoredTile): Promise<void> {
  const transaction = database.transaction(tileStore, "readwrite");
  transaction.objectStore(tileStore).put(value);
  await transactionComplete(transaction);
}

async function deletePackage(database: IDBDatabase, packageId: string): Promise<void> {
  const tileTransaction = database.transaction(tileStore, "readonly");
  const tileTransactionDone = transactionComplete(tileTransaction);
  const tiles = (await requestResult(tileTransaction.objectStore(tileStore).getAll())) as StoredTile[];
  await tileTransactionDone;
  const transaction = database.transaction([packageStore, tileStore], "readwrite");
  transaction.objectStore(packageStore).delete(packageId);
  for (const tile of tiles) if (tile.packageId === packageId) transaction.objectStore(tileStore).delete(tile.key);
  await transactionComplete(transaction);
}

async function activatePackage(database: IDBDatabase, packageToActivate: StoredPackage): Promise<void> {
  const readTransaction = database.transaction(packageStore, "readonly");
  const readTransactionDone = transactionComplete(readTransaction);
  const packages = (await requestResult(readTransaction.objectStore(packageStore).getAll())) as StoredPackage[];
  await readTransactionDone;
  const transaction = database.transaction(packageStore, "readwrite");
  const store = transaction.objectStore(packageStore);
  for (const item of packages) {
    if (item.mode === packageToActivate.mode && item.status === "active") store.put({ ...item, status: "archived" });
  }
  store.put({ ...packageToActivate, status: "active" });
  await transactionComplete(transaction);
}

async function readTile(database: IDBDatabase, key: string): Promise<ArrayBuffer | null> {
  const transaction = database.transaction(tileStore, "readonly");
  const transactionDone = transactionComplete(transaction);
  const tile = (await requestResult(transaction.objectStore(tileStore).get(key))) as StoredTile | undefined;
  await transactionDone;
  return tile?.data ?? null;
}

async function readPackageTiles(database: IDBDatabase, packageId: string): Promise<StoredTile[]> {
  const transaction = database.transaction(tileStore, "readonly");
  const transactionDone = transactionComplete(transaction);
  const tiles = (await requestResult(transaction.objectStore(tileStore).getAll())) as StoredTile[];
  await transactionDone;
  return tiles.filter((tile) => tile.packageId === packageId);
}

async function verifyPackage(database: IDBDatabase, packageToVerify: OfflineTilePackage): Promise<boolean> {
  if (packageToVerify.downloadedTiles !== packageToVerify.tileCount) return false;
  const tiles = await readPackageTiles(database, packageToVerify.id);
  if (tiles.length !== packageToVerify.tileCount) return false;
  const checksums: string[] = [];
  for (const tile of tiles.sort((left, right) => left.key.localeCompare(right.key))) {
    checksums.push(`${tile.sourceIndex}/${tile.z}/${tile.x}/${tile.y}:${await sha256(tile.data)}`);
  }
  return await sha256(new TextEncoder().encode(checksums.join("|"))) === packageToVerify.checksum;
}

async function archivePackage(database: IDBDatabase, packageToArchive: OfflineTilePackage): Promise<void> {
  const transaction = database.transaction(packageStore, "readwrite");
  transaction.objectStore(packageStore).put({ ...packageToArchive, status: "archived" } satisfies StoredPackage);
  await transactionComplete(transaction);
}

export async function listOfflinePackages(): Promise<OfflineTilePackage[]> {
  const database = await openDatabase();
  const transaction = database.transaction(packageStore, "readonly");
  const transactionDone = transactionComplete(transaction);
  const packages = (await requestResult(transaction.objectStore(packageStore).getAll())) as StoredPackage[];
  await transactionDone;
  for (const item of packages.filter((candidate) => candidate.status === "staging" && Date.now() - Date.parse(candidate.updatedAt) > 60 * 60 * 1000)) {
    await deletePackage(database, item.id);
  }
  const validPackages: OfflineTilePackage[] = [];
  for (const item of packages.filter((candidate) => candidate.status === "active" && candidate.format === "indexeddb-raster-tiles-v1")) {
    const packageToCheck = item as OfflineTilePackage;
    if (await verifyPackage(database, packageToCheck)) validPackages.push(packageToCheck);
    else await archivePackage(database, packageToCheck);
  }
  return validPackages;
}

export async function getActiveOfflinePackage(mode: Extract<BasemapKey, "street" | "hybrid">, manifestVersion: string, sourceTemplates: string[]): Promise<OfflineTilePackage | null> {
  const packages = await listOfflinePackages();
  return packages
    .filter((item) => item.mode === mode && item.manifestVersion === manifestVersion && item.sourceTemplates.length === sourceTemplates.length && item.sourceTemplates.every((template, index) => template === sourceTemplates[index]))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export function offlineTileTemplates(packageId: string, sourceCount: number): string[] {
  return Array.from({ length: sourceCount }, (_, sourceIndex) => `${offlineProtocol}://${encodeURIComponent(packageId)}/${sourceIndex}/{z}/{x}/{y}`);
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
  const { bounds, maxZoom, minZoom, mode, manifestVersion, sourceTemplates, signal, onProgress, zoomLimits } = options;
  const selectionError = validateOfflineSelection(bounds, minZoom, maxZoom, zoomLimits);
  if (selectionError) throw new Error(selectionError);
  if (!sourceTemplates.length || sourceTemplates.some((template) => !template.includes("{z}") || !template.includes("{x}") || !template.includes("{y}"))) throw new Error("Manifest không cung cấp tile source hợp lệ cho mode này.");

  const tileCoordinates = tilesForBounds(bounds, minZoom, maxZoom);
  const tileCount = tileCoordinates.length * sourceTemplates.length;
  if (tileCount > maxOfflineTiles) throw new Error(`Package tạo ${tileCount.toLocaleString("vi-VN")} tile, vượt giới hạn ${maxOfflineTiles.toLocaleString("vi-VN")}.`);
  const packageId = `${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const database = await openDatabase();
  const staged: StoredPackage = {
    id: packageId,
    format: "indexeddb-raster-tiles-v1",
    manifestVersion,
    mode,
    sourceTemplates,
    bounds,
    minZoom,
    maxZoom,
    tileCount,
    downloadedTiles: 0,
    sizeBytes: 0,
    checksum: "",
    createdAt: now,
    updatedAt: now,
    status: "staging",
  };
  await putPackage(database, staged);
  const tileChecksums: string[] = [];
  let downloadedTiles = 0;
  let sizeBytes = 0;

  try {
    for (const [z, x, y] of tileCoordinates) {
      for (let sourceIndex = 0; sourceIndex < sourceTemplates.length; sourceIndex += 1) {
        if (signal?.aborted) throw new DOMException("Tile download canceled", "AbortError");
        const response = await fetch(templateUrl(sourceTemplates[sourceIndex], z, x, y), { signal });
        if (!response.ok) throw new Error(`Không tải được tile (${response.status}).`);
        const data = await response.arrayBuffer();
        tileChecksums.push(`${sourceIndex}/${z}/${x}/${y}:${await sha256(data)}`);
        sizeBytes += data.byteLength;
        downloadedTiles += 1;
        await putTile(database, { key: tileKey(packageId, sourceIndex, z, x, y), packageId, sourceIndex, z, x, y, data });
        await putPackage(database, { ...staged, downloadedTiles, sizeBytes, updatedAt: new Date().toISOString() });
        onProgress?.({ downloadedTiles, tileCount, sizeBytes });
      }
    }
    const checksum = await sha256(new TextEncoder().encode(tileChecksums.join("|")));
    const completed: OfflineTilePackage = { ...staged, downloadedTiles, sizeBytes, checksum, updatedAt: new Date().toISOString(), status: "active" };
    await activatePackage(database, completed);
    return completed;
  } catch (error) {
    await deletePackage(database, packageId).catch(() => undefined);
    throw error;
  }
}

async function loadOfflineTile(request: { url: string }, abortController: AbortController): Promise<{ data: ArrayBuffer }> {
  const match = new RegExp(`^${offlineProtocol}://([^/]+)/(\\d+)/(\\d+)/(\\d+)/(\\d+)$`).exec(request.url.split("?")[0]);
  if (!match) throw new Error("Offline tile URL không hợp lệ.");
  if (abortController.signal.aborted) throw new DOMException("Offline tile request canceled", "AbortError");
  const database = await openDatabase();
  const data = await readTile(database, tileKey(decodeURIComponent(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5])));
  if (!data) throw new Error("Viewport nằm ngoài vùng tile package offline.");
  return { data };
}

export function ensureOfflineBasemapProtocol(): void {
  if (protocolRegistered) return;
  addProtocol(offlineProtocol, loadOfflineTile);
  protocolRegistered = true;
}
