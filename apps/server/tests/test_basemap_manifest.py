import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.shared.schemas import BasemapManifest


def test_basemap_manifest_is_display_only_and_complete() -> None:
    response = TestClient(app).get("/api/v1/basemap/manifest")

    assert response.status_code == 200
    payload = response.json()
    assert payload["schemaVersion"] == 1
    assert set(payload["modes"]) == {"street", "hybrid", "vector"}
    assert {layer["key"] for layer in payload["layers"]} == {
        "transport",
        "roadLabels",
        "administrative",
        "places",
        "placeLabels",
        "landWater",
    }
    place_labels = next(layer for layer in payload["layers"] if layer["key"] == "placeLabels")
    assert place_labels["excludePrefixes"] == ["label_state", "label_country"]
    assert not {"projects", "entities", "cameras", "projectData"}.intersection(payload)
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["etag"]
    assert response.headers["last-modified"]


def test_basemap_manifest_supports_etag_and_last_modified_revalidation() -> None:
    client = TestClient(app)
    first = client.get("/api/v1/basemap/manifest")

    by_etag = client.get(
        "/api/v1/basemap/manifest",
        headers={"If-None-Match": first.headers["etag"]},
    )
    by_date = client.get(
        "/api/v1/basemap/manifest",
        headers={"If-Modified-Since": first.headers["last-modified"]},
    )

    assert by_etag.status_code == 304
    assert by_date.status_code == 304
    assert by_etag.content == b""
    assert by_date.content == b""


def test_basemap_manifest_rejects_invalid_contract() -> None:
    with pytest.raises(ValidationError):
        BasemapManifest.model_validate(
            {
                "schemaVersion": 1,
                "manifestVersion": "invalid",
                "generatedAt": "2026-08-10T00:00:00Z",
                "defaultMode": "vector",
                "modes": {"vector": {"key": "vector", "label": "Vector", "detail": "only", "source": {"kind": "style", "styleUrl": "https://example.test/style.json"}}},
                "layers": [],
                "attribution": ["MapLibre"],
                "tilePackages": {"supported": True, "selection": "boundingBox", "minZoom": 12, "maxZoom": 4, "storage": "desktop-local"},
            }
        )
