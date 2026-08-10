from __future__ import annotations

import hashlib
import json
from datetime import datetime
from email.utils import format_datetime

from .schemas import BasemapManifest


_MANIFEST = BasemapManifest.model_validate(
    {
        "schemaVersion": 2,
        "manifestVersion": "2026-08-10.2",
        "generatedAt": "2026-08-10T00:00:00Z",
        "defaultMode": "vector",
        "modes": {
            "street": {
                "key": "street",
                "label": "Street",
                "detail": "Google public roads · online-only",
                "source": {
                    "kind": "raster",
                    "provider": "google",
                    "layerControl": "baked-raster",
                    "tiles": ["https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"],
                    "styleUrl": None,
                    "offline": {"supported": False, "kind": "none", "glyphs": None, "sprite": None},
                },
            },
            "hybrid": {
                "key": "hybrid",
                "label": "Hybrid",
                "detail": "Google public imagery · online-only",
                "source": {
                    "kind": "raster",
                    "provider": "google",
                    "layerControl": "baked-raster",
                    "tiles": ["https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"],
                    "styleUrl": None,
                    "offline": {"supported": False, "kind": "none", "glyphs": None, "sprite": None},
                },
            },
            "vector": {
                "key": "vector",
                "label": "Vector",
                "detail": "OpenStreetMap/OpenFreeMap vector · offline",
                "source": {
                    "kind": "style",
                    "provider": "openstreetmap",
                    "layerControl": "style-layer",
                    "tiles": ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf"],
                    "styleUrl": "https://tiles.openfreemap.org/styles/bright",
                    "offline": {
                        "supported": True,
                        "kind": "vector-style",
                        "glyphs": "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
                        "sprite": "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
                    },
                },
            },
        },
        "layers": [
            {
                "key": "transport",
                "label": "Đường & giao thông",
                "detail": "Đường bộ, cầu, đường sắt",
                "color": "#3b82f6",
                "layerPrefixes": ["highway", "road_", "tunnel-", "bridge-", "railway", "ferry", "cablecar", "aeroway"],
                "excludePrefixes": [],
                "defaultVisibility": True,
            },
            {
                "key": "roadLabels",
                "label": "Tên đường",
                "detail": "Tên và mã tuyến đường",
                "color": "#0f766e",
                "layerPrefixes": ["highway-name", "road_shield", "highway-shield"],
                "excludePrefixes": [],
                "defaultVisibility": True,
            },
            {
                "key": "administrative",
                "label": "Địa giới & hành chính",
                "detail": "Biên giới, tỉnh/thành, quốc gia",
                "color": "#a855f7",
                "layerPrefixes": ["boundary", "label_state", "label_country"],
                "excludePrefixes": [],
                "defaultVisibility": True,
            },
            {
                "key": "places",
                "label": "Địa điểm công cộng",
                "detail": "POI, sân bay, điểm công cộng",
                "color": "#f97316",
                "layerPrefixes": ["poi", "airport"],
                "excludePrefixes": [],
                "defaultVisibility": True,
            },
            {
                "key": "placeLabels",
                "label": "Tên địa danh",
                "detail": "Thành phố, thị trấn, địa danh",
                "color": "#be123c",
                "layerPrefixes": ["label_"],
                "excludePrefixes": ["label_state", "label_country"],
                "defaultVisibility": True,
            },
            {
                "key": "landWater",
                "label": "Đất, nước & công trình",
                "detail": "Sông, hồ, đất phủ, tòa nhà",
                "color": "#64748b",
                "layerPrefixes": ["landcover", "landuse", "park", "water", "waterway", "building", "road_area", "road_pier", "highway-area"],
                "excludePrefixes": [],
                "defaultVisibility": True,
            },
        ],
        "attribution": [
            "© OpenStreetMap contributors",
            "Google Maps tiles (experimental)",
            "MapLibre",
        ],
        "tilePackages": {
            "supported": True,
            "supportedModes": ["vector"],
            "selection": "boundingBox",
            "minZoom": 0,
            "maxZoom": 18,
            "storage": "desktop-local",
        },
    }
)


def get_basemap_manifest() -> BasemapManifest:
    return _MANIFEST


def manifest_json(manifest: BasemapManifest | None = None) -> bytes:
    payload = (manifest or _MANIFEST).model_dump(mode="json")
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def manifest_etag(manifest: BasemapManifest | None = None) -> str:
    return '"' + hashlib.sha256(manifest_json(manifest)).hexdigest() + '"'


def manifest_last_modified(manifest: BasemapManifest | None = None) -> str:
    value = datetime.fromisoformat((manifest or _MANIFEST).generatedAt.replace("Z", "+00:00"))
    return format_datetime(value, usegmt=True)
