import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { BasemapManifest } from "@project/domain";
import { bundledManifest, defaultLayerVisibilityFromManifest, layerGroupMatchScore, layerGroupsFromManifest, loadBasemapManifest, manifestModes, readBasemapPreference, readCachedManifest, readLayerPreferences, vectorStyleUrl, type BasemapKey, type LayerVisibility, type MapLayerKey } from "./mapConfig";
import { ensureOfflineBasemapProtocol, getActiveOfflinePackage, packageCoversViewport, type OfflineTilePackage } from "./offlineBasemap";
import { OfflineBasemapPanel } from "./OfflineBasemapPanel";
import { Button, Icon, PageHeader, Panel, StatusBadge } from "../../shared/ui";

export function MapLibreMapView({
  layerVisibility,
  manifest,
  mode,
  offlinePackage,
  online,
  notice,
  onLayerToggle,
  onModeChange,
  onOfflinePackageReady,
}: {
  layerVisibility: LayerVisibility;
  manifest: BasemapManifest;
  mode: BasemapKey;
  offlinePackage: OfflineTilePackage | null;
  online: boolean;
  notice?: string;
  onLayerToggle: (key: MapLayerKey) => void;
  onModeChange: (mode: BasemapKey) => void;
  onOfflinePackageReady: (packageToUse: OfflineTilePackage | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [offlineNotice, setOfflineNotice] = useState("");
  const [googleMapUrl, setGoogleMapUrl] = useState("https://www.google.com/maps/@21.0285,105.8542,12z");
  const modeRef = useRef(mode);
  const onlineRef = useRef(online);
  const offlinePackageRef = useRef(offlinePackage);
  modeRef.current = mode;
  onlineRef.current = online;
  offlinePackageRef.current = offlinePackage;
  const basemapModes = manifestModes(manifest);
  const mapLayerGroups = layerGroupsFromManifest(manifest);

  useEffect(() => {
    if (!containerRef.current) return;
    ensureOfflineBasemapProtocol();
    setMapReady(false);
    setMapError("");
    setOfflineNotice("");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: online ? manifest.modes.vector.source.styleUrl ?? vectorStyleUrl : (offlinePackage?.style as StyleSpecification | undefined) ?? {
        version: 8,
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": "#eef2f7" } }],
      },
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
      const currentPackage = offlinePackageRef.current;
      if (onlineRef.current) setOfflineNotice("");
      else if (!currentPackage || currentPackage.mode !== "vector") setOfflineNotice("Offline tự động chuyển sang OSM Vector; hãy tải package OSM trong phần nền bản đồ.");
      else {
        const viewport = map.getBounds();
        const viewportBounds = { west: viewport.getWest(), south: viewport.getSouth(), east: viewport.getEast(), north: viewport.getNorth() };
        if (!packageCoversViewport(currentPackage, viewportBounds) || zoom < currentPackage.minZoom || zoom > currentPackage.maxZoom) setOfflineNotice("Viewport ngoài phạm vi package offline; vùng trống. Hãy tải thêm khu vực hoặc zoom đã chọn.");
        else setOfflineNotice("");
      }
    };
    const handleMapError = (event: { error?: Error; sourceId?: string }) => {
      if (event.error) setMapError("Không tải được một phần nền bản đồ. Bạn có thể đổi chế độ nền.");
    };

    map.on("error", handleMapError);
    map.on("moveend", updateGoogleMapUrl);
    map.on("load", () => {
      if (online) {
        const firstDataLayer = map.getStyle().layers?.find((layer: { id: string }) => layer.id !== "background")?.id;
        map.addSource("google-street", {
          type: "raster",
          tiles: manifest.modes.street.source.tiles,
          tileSize: 256,
          attribution: "Google Maps (online-only)",
        });
        map.addSource("google-hybrid", {
          type: "raster",
          tiles: manifest.modes.hybrid.source.tiles,
          tileSize: 256,
          attribution: "Google Maps (online-only)",
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
      }
      setMapReady(true);
      updateGoogleMapUrl();
    });

    return () => {
      map.off("error", handleMapError);
      map.off("moveend", updateGoogleMapUrl);
      map.remove();
      mapRef.current = null;
    };
  }, [manifest, offlinePackage, online]);

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
      const group = mapLayerGroups
        .filter((candidate) => candidate.matches(layer.id))
        .sort((left, right) => layerGroupMatchScore(right, layer.id) - layerGroupMatchScore(left, layer.id))[0];
      if (group) setVisibility(layer.id, layerVisibility[group.key] ? "visible" : "none");
    }
  }, [layerVisibility, manifest, mapReady, mode]);

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
          <span>{online ? (mode === "vector" ? "OSM Vector" : "Google raster + OSM layers") : "OSM Vector · offline fallback"}</span>
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
        <div className="map-layer-note">Google Street/Hybrid là raster baked, chỉ online; checkbox chỉ điều khiển các layer style của OSM Vector.</div>
      </div>
      <OfflineBasemapPanel manifest={manifest} activePackage={offlinePackage} onPackageReady={onOfflinePackageReady} />
      <a className="map-google-link" href={googleMapUrl} rel="noreferrer" target="_blank">
        Mở vị trí hiện tại trên Google Maps ↗
      </a>
      <div className="map-attribution">{manifest.attribution.join(" · ")}</div>
      {mapError || offlineNotice || notice ? <div className="map-error" role="status">{mapError || offlineNotice || notice}</div> : null}
    </div>
  );
}


export function DesignView({ onAction }: { onAction: (message: string) => void }) {
  const initialManifest = readCachedManifest() ?? bundledManifest;
  const [manifest, setManifest] = useState<BasemapManifest>(initialManifest);
  const [manifestNotice, setManifestNotice] = useState("");
  const [basemap, setBasemap] = useState<BasemapKey>(readBasemapPreference);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(() => readLayerPreferences(defaultLayerVisibilityFromManifest(initialManifest)));
  const [offlinePackage, setOfflinePackage] = useState<OfflineTilePackage | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const effectiveBasemap: BasemapKey = online ? basemap : "vector";
  const hasSavedLayerPreferences = useRef(Boolean(window.localStorage.getItem("pp-design-map-layers")));
  const layerPreferencesInitialized = useRef(false);

  const handleOfflinePackageReady = useCallback((packageToUse: OfflineTilePackage | null) => {
    setOfflinePackage(packageToUse);
  }, []);

  useEffect(() => {
    ensureOfflineBasemapProtocol();
    let cancelled = false;
    const refreshPackage = () => {
      void getActiveOfflinePackage(manifest.manifestVersion, manifest.modes.vector.source.tiles).then((packageToUse) => {
        if (!cancelled) setOfflinePackage(packageToUse);
      }).catch(() => {
        if (!cancelled) setOfflinePackage(null);
      });
    };
    refreshPackage();
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [manifest]);

  useEffect(() => {
    let cancelled = false;
    const refreshManifest = () => {
      void loadBasemapManifest().then((result) => {
        if (cancelled) return;
        setManifest(result.manifest);
        setManifestNotice(result.notice ?? "");
        if (!hasSavedLayerPreferences.current) setLayerVisibility(defaultLayerVisibilityFromManifest(result.manifest));
      });
    };
    refreshManifest();
    window.addEventListener("online", refreshManifest);
    const interval = window.setInterval(refreshManifest, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", refreshManifest);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pp-design-basemap", basemap);
  }, [basemap]);

  useEffect(() => {
    if (!layerPreferencesInitialized.current) {
      layerPreferencesInitialized.current = true;
      return;
    }
    window.localStorage.setItem("pp-design-map-layers", JSON.stringify(layerVisibility));
    hasSavedLayerPreferences.current = true;
  }, [layerVisibility]);

  const changeBasemap = (next: BasemapKey) => {
    setBasemap(next);
    onAction(`Đã chuyển nền bản đồ sang ${manifestModes(manifest).find((item) => item.key === next)?.label}`);
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
            key={`${manifest.manifestVersion}-${effectiveBasemap}-${online}-${offlinePackage?.id ?? "none"}`}
            layerVisibility={layerVisibility}
            manifest={manifest}
            mode={effectiveBasemap}
            offlinePackage={offlinePackage}
            online={online}
            notice={manifestNotice}
            onLayerToggle={toggleLayer}
            onModeChange={changeBasemap}
            onOfflinePackageReady={handleOfflinePackageReady}
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


