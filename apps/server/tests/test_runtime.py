from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import main
from app.auth import AuthenticationError, authenticate_bearer
from app.persistence import decode_store_state, encode_store_state
from app.domain import CameraStore


def test_health_and_metrics_expose_runtime_contract() -> None:
    client = TestClient(main.app)

    live = client.get("/health/live")
    assert live.status_code == 200
    assert live.headers["x-request-id"]

    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "project_digital_twin_requests_total" in metrics.text


def test_production_requires_durable_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        main._build_store()


def test_domain_snapshot_codec_round_trips_uuid_and_datetimes(tmp_path) -> None:
    store = CameraStore()
    project = store.create_project("Smoke", str(tmp_path))

    restored = decode_store_state(encode_store_state(store))

    assert restored["projects"][project.id].id == project.id
    assert restored["projects"][project.id].root_path == str(tmp_path.resolve())


def test_production_auth_rejects_missing_bearer() -> None:
    with pytest.raises(AuthenticationError, match="Bearer"):
        authenticate_bearer(None)


def test_production_api_rejects_anonymous_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    original_store = main.store
    main.store = CameraStore()
    try:
        response = TestClient(main.app).get("/api/v1/projects")
    finally:
        main.store = original_store
    assert response.status_code == 401
