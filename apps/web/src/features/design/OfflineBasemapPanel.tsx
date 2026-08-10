import { useEffect, useRef, useState } from "react";
import type { BasemapManifest } from "@project/domain";
import { downloadTilePackage, listOfflinePackages, type OfflineBounds, type OfflineTilePackage, type TileDownloadProgress } from "./offlineBasemap";

const defaultBounds: OfflineBounds = { west: 105.7, south: 20.8, east: 106, north: 21.2 };

export function OfflineBasemapPanel({
  manifest,
  activePackage,
  onPackageReady,
}: {
  manifest: BasemapManifest;
  activePackage: OfflineTilePackage | null;
  onPackageReady: (packageToUse: OfflineTilePackage | null) => void;
}) {
  const defaultMinZoom = Math.min(Math.max(manifest.tilePackages.minZoom, 10), manifest.tilePackages.maxZoom);
  const defaultMaxZoom = Math.max(defaultMinZoom, Math.min(manifest.tilePackages.maxZoom, 14));
  const [bounds, setBounds] = useState<OfflineBounds>(defaultBounds);
  const [minZoom, setMinZoom] = useState(defaultMinZoom);
  const [maxZoom, setMaxZoom] = useState(defaultMaxZoom);
  const [packages, setPackages] = useState<OfflineTilePackage[]>([]);
  const [progress, setProgress] = useState<TileDownloadProgress | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listOfflinePackages()
      .then((items) => {
        if (cancelled) return;
        const sourceTemplates = manifest.modes.vector.source.tiles;
        const compatible = items.filter((item) => item.mode === "vector" && item.manifestVersion === manifest.manifestVersion && item.sourceTemplates.length === sourceTemplates.length && item.sourceTemplates.every((template, index) => template === sourceTemplates[index]));
        setPackages(compatible);
        onPackageReady(compatible[0] ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Không thể đọc package offline.");
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, onPackageReady]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const startDownload = async () => {
    const source = manifest.modes.vector.source;
    if (source.kind === "style") {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setMessage("");
      setProgress(null);
      try {
        const packageToUse = await downloadTilePackage({
          mode: "vector",
          manifestVersion: manifest.manifestVersion,
          source,
          bounds,
          minZoom,
          maxZoom,
          zoomLimits: { min: packageCapability.minZoom, max: packageCapability.maxZoom },
          signal: controller.signal,
          onProgress: setProgress,
        });
        setPackages([packageToUse]);
        onPackageReady(packageToUse);
        setMessage(`Đã lưu OSM Vector: ${packageToUse.downloadedTiles.toLocaleString("vi-VN")} tile và ${packageToUse.downloadedAssets.toLocaleString("vi-VN")} asset (${formatBytes(packageToUse.sizeBytes)}).`);
      } catch (error: unknown) {
        setMessage(error instanceof Error && error.name === "AbortError" ? "Đã hủy tải package; package đang hoạt động vẫn được giữ nguyên." : error instanceof Error ? error.message : "Không thể tải package OSM offline.");
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
      return;
    }
    setMessage("Manifest OSM không cung cấp style source hợp lệ.");
  };

  const packageForMode = activePackage ?? packages[0] ?? null;
  const packageCapability = manifest.tilePackages;

  return (
    <div className="map-offline-card">
      <div className="map-layer-head">
        <b className="map-layer-title">Gói nền offline</b>
        <span>{packageForMode ? "Sẵn sàng" : "Chưa tải"}</span>
      </div>
      <div className="map-offline-hint">OSM Vector package gồm style, vector/raster tiles, glyphs, sprite, checksum và metadata vùng/zoom; không chứa dữ liệu dự án. Google Street/Hybrid chỉ online.</div>
      {!packageCapability.supported || !packageCapability.supportedModes.includes("vector") ? <div className="map-offline-message">Manifest hiện không bật package OSM Vector.</div> : null}
      <div className="map-offline-grid">
        <label>Tây<input type="number" step="0.001" value={bounds.west} onChange={(event) => setBounds((current) => ({ ...current, west: Number(event.target.value) }))} /></label>
        <label>Nam<input type="number" step="0.001" value={bounds.south} onChange={(event) => setBounds((current) => ({ ...current, south: Number(event.target.value) }))} /></label>
        <label>Đông<input type="number" step="0.001" value={bounds.east} onChange={(event) => setBounds((current) => ({ ...current, east: Number(event.target.value) }))} /></label>
        <label>Bắc<input type="number" step="0.001" value={bounds.north} onChange={(event) => setBounds((current) => ({ ...current, north: Number(event.target.value) }))} /></label>
        <label>Zoom từ<input type="number" min={packageCapability.minZoom} max={packageCapability.maxZoom} value={minZoom} onChange={(event) => setMinZoom(Number(event.target.value))} /></label>
        <label>Zoom đến<input type="number" min={packageCapability.minZoom} max={packageCapability.maxZoom} value={maxZoom} onChange={(event) => setMaxZoom(Number(event.target.value))} /></label>
      </div>
      <div className="map-offline-actions">
        <button type="button" disabled={busy || !packageCapability.supported || !packageCapability.supportedModes.includes("vector")} onClick={() => void startDownload()}>{busy ? "Đang tải…" : "Tải OSM Vector"}</button>
        {busy ? <button type="button" onClick={() => abortRef.current?.abort()}>Hủy</button> : null}
      </div>
      {progress ? <div className="map-offline-progress" role="status">{progress.downloadedAssets.toLocaleString("vi-VN")}/{progress.assetCount.toLocaleString("vi-VN")} asset · {progress.downloadedTiles.toLocaleString("vi-VN")} tile · {formatBytes(progress.sizeBytes)}</div> : null}
      {packageForMode ? <div className="map-offline-meta">Vùng {packageForMode.bounds.south.toFixed(3)}–{packageForMode.bounds.north.toFixed(3)} · zoom {packageForMode.minZoom}–{packageForMode.maxZoom} · checksum {packageForMode.checksum.slice(0, 12)}…</div> : null}
      {message ? <div className="map-offline-message" role="status">{message}</div> : null}
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
