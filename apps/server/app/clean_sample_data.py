"""CLI Utility to clean pre-existing sample data from server persistence stores.

Run via: python -m app.clean_sample_data
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

from .domain import CameraStore
from .platform.runtime import build_store
from .persistence import PostgresCameraStore, encode_store_state


def clean_database(database_url: str, store_key: str = "canonical") -> bool:
    """Reset PostgreSQL runtime_store_snapshots to empty state without dropping tables."""
    try:
        import psycopg
    except ImportError:
        print("[ERROR] psycopg package is required to clean PostgreSQL database.")
        return False

    empty_store = CameraStore()
    empty_state_json = json.dumps(encode_store_state(empty_store))

    print(f"[INFO] Cleaning database at store_key='{store_key}'...")
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO runtime_store_snapshots(store_key, state, revision, updated_at)
                VALUES (%s, %s::jsonb, 0, now())
                ON CONFLICT (store_key) DO UPDATE
                SET state = %s::jsonb, revision = 0, updated_at = now();
                """,
                (store_key, empty_state_json, empty_state_json),
            )
            connection.commit()
    print("[SUCCESS] Database store reset to clean empty state.")
    return True


def main() -> None:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        success = clean_database(database_url)
        if not success:
            sys.exit(1)
    else:
        store = build_store()
        if isinstance(store, PostgresCameraStore):
            success = clean_database(store.database_url, store.store_key)
            if not success:
                sys.exit(1)
        else:
            empty_store = CameraStore()
            print(f"[INFO] In-memory CameraStore initialized clean (is_empty={empty_store.is_empty()}).")
            print("[SUCCESS] In-memory store clean.")


if __name__ == "__main__":
    main()
