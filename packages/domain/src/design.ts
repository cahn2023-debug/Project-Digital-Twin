import type { EntityId, Representation, RevisionNumber } from "./core";

export interface EntityRevision {
  id: string;
  entityId: EntityId;
  representation: Representation;
  revision: RevisionNumber;
  data: Record<string, unknown>;
  geometry: { latitude: number; longitude: number } | null;
  createdAt: string;
  createdBy: string;
  changesetId: string | null;
}

export type BasemapKey = "street" | "hybrid" | "vector";
export type BasemapSourceKind = "raster" | "style";
export type BasemapProvider = "google" | "openstreetmap";
export type BasemapLayerControl = "baked-raster" | "style-layer";
export type BasemapOfflineAssetKind = "none" | "vector-style";

export interface BasemapOfflineAssets {
  supported: boolean;
  kind: BasemapOfflineAssetKind;
  glyphs: string | null;
  sprite: string | null;
}

export interface BasemapSource {
  kind: BasemapSourceKind;
  provider: BasemapProvider;
  layerControl: BasemapLayerControl;
  tiles: string[];
  styleUrl: string | null;
  offline: BasemapOfflineAssets;
}

export interface BasemapMode {
  key: BasemapKey;
  label: string;
  detail: string;
  source: BasemapSource;
}

export interface BasemapLayerGroup {
  key: string;
  label: string;
  detail: string;
  color: string;
  layerPrefixes: string[];
  excludePrefixes: string[];
  defaultVisibility: boolean;
}

export interface TilePackageCapabilities {
  supported: boolean;
  supportedModes: BasemapKey[];
  selection: "boundingBox";
  minZoom: number;
  maxZoom: number;
  storage: "desktop-local";
}

export interface BasemapManifest {
  schemaVersion: number;
  manifestVersion: string;
  generatedAt: string;
  defaultMode: BasemapKey;
  modes: Record<BasemapKey, BasemapMode>;
  layers: BasemapLayerGroup[];
  attribution: string[];
  tilePackages: TilePackageCapabilities;
}
