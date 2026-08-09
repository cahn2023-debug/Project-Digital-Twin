from __future__ import annotations

import json
from contextlib import contextmanager
from dataclasses import fields, is_dataclass
from datetime import datetime
from typing import Any, Iterator
from uuid import UUID

from . import domain


_DOMAIN_DATACLASSES = {
    name: value
    for name, value in vars(domain).items()
    if isinstance(value, type) and is_dataclass(value)
}
_ADAPTER_STATE_FIELDS = {"database_url", "store_key"}


def _encode(value: Any) -> Any:
    if isinstance(value, UUID):
        return {"__kind__": "uuid", "value": str(value)}
    if isinstance(value, datetime):
        return {"__kind__": "datetime", "value": value.isoformat()}
    if is_dataclass(value):
        return {
            "__kind__": "dataclass",
            "type": type(value).__name__,
            "fields": {field.name: _encode(getattr(value, field.name)) for field in fields(value)},
        }
    if isinstance(value, dict):
        return {
            "__kind__": "dict",
            "items": [[_encode(key), _encode(item)] for key, item in value.items()],
        }
    if isinstance(value, set):
        return {"__kind__": "set", "items": [_encode(item) for item in value]}
    if isinstance(value, tuple):
        return {"__kind__": "tuple", "items": [_encode(item) for item in value]}
    if isinstance(value, list):
        return [_encode(item) for item in value]
    return value


def _decode(value: Any) -> Any:
    if isinstance(value, list):
        return [_decode(item) for item in value]
    if not isinstance(value, dict):
        return value

    kind = value.get("__kind__")
    if kind == "uuid":
        return UUID(value["value"])
    if kind == "datetime":
        return datetime.fromisoformat(value["value"])
    if kind == "dict":
        return {_decode(key): _decode(item) for key, item in value["items"]}
    if kind == "set":
        return {_decode(item) for item in value["items"]}
    if kind == "tuple":
        return tuple(_decode(item) for item in value["items"])
    if kind == "dataclass":
        data_class = _DOMAIN_DATACLASSES.get(value["type"])
        if data_class is None:
            raise ValueError(f"Unknown persisted domain type: {value['type']}")
        return data_class(**{name: _decode(item) for name, item in value["fields"].items()})
    return {key: _decode(item) for key, item in value.items()}


def encode_store_state(store: Any) -> dict[str, Any]:
    return _encode(
        {
            key: value
            for key, value in store.__dict__.items()
            if key not in _ADAPTER_STATE_FIELDS
        }
    )


def decode_store_state(state: dict[str, Any]) -> dict[str, Any]:
    decoded = _decode(state)
    if not isinstance(decoded, dict):
        raise ValueError("Persisted store state must be an object")
    return decoded


class PostgresCameraStore(domain.CameraStore):
    """Transactional PostgreSQL persistence for the existing canonical service boundary.

    The current domain service remains the source of invariants while this adapter
    provides durable, serialized state during the vertical-slice migration. Every
    HTTP request runs inside one database transaction and writes only when state
    changed; the migration keeps the snapshot versioned for later relational
    decomposition without reintroducing process-local canonical state.
    """

    def __init__(self, database_url: str, store_key: str = "canonical") -> None:
        super().__init__()
        if not database_url.strip():
            raise ValueError("DATABASE_URL is required for PostgreSQL persistence")
        self.database_url = database_url
        self.store_key = store_key

    @staticmethod
    def _driver() -> Any:
        try:
            import psycopg
        except ImportError as exc:  # pragma: no cover - covered by deployment smoke checks
            raise RuntimeError("psycopg is required for PostgreSQL persistence") from exc
        return psycopg

    def _read_state(self, cursor: Any, *, lock: bool) -> dict[str, Any]:
        cursor.execute(
            """
            INSERT INTO runtime_store_snapshots(store_key, state)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (store_key) DO NOTHING
            """,
            (self.store_key, json.dumps({})),
        )
        cursor.execute(
            "SELECT state FROM runtime_store_snapshots WHERE store_key = %s" + (" FOR UPDATE" if lock else ""),
            (self.store_key,),
        )
        row = cursor.fetchone()
        if row is None:
            raise RuntimeError("PostgreSQL runtime store row was not created")
        state = row[0]
        if isinstance(state, str):
            state = json.loads(state)
        return decode_store_state(state)

    def _replace_state(self, state: dict[str, Any]) -> None:
        self.__dict__.update(state)

    @contextmanager
    def request_context(self) -> Iterator[None]:
        """Load, lock, and commit one canonical request transaction."""

        psycopg = self._driver()
        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                state = self._read_state(cursor, lock=True)
                self._replace_state(state)
                before = json.dumps(encode_store_state(self), sort_keys=True)
                try:
                    yield
                    after_state = encode_store_state(self)
                    after = json.dumps(after_state, sort_keys=True)
                    if after != before:
                        cursor.execute(
                            """
                            UPDATE runtime_store_snapshots
                            SET state = %s::jsonb,
                                revision = revision + 1,
                                updated_at = now()
                            WHERE store_key = %s
                            """,
                            (json.dumps(after_state), self.store_key),
                        )
                    connection.commit()
                except Exception:
                    connection.rollback()
                    raise

    def health(self) -> dict[str, Any]:
        psycopg = self._driver()
        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT revision, updated_at FROM runtime_store_snapshots WHERE store_key = %s",
                    (self.store_key,),
                )
                row = cursor.fetchone()
        return {
            "status": "ok",
            "canonical_store": "postgresql",
            "snapshot_revision": row[0] if row else 0,
            "updated_at": row[1].isoformat() if row and row[1] else None,
        }
