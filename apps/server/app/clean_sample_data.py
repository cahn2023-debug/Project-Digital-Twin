"""Safely clear development data while preserving database schemas.

Examples:
    python -m app.clean_sample_data --desktop-manifest path/to/manifest.db --yes
    python -m app.clean_sample_data --database-url "$DATABASE_URL" --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Sequence

from .persistence import PostgresCameraStore, encode_store_state


def _sqlite_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _sqlite_tables(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    return [row[0] for row in rows]


def clean_sqlite_database(path: str, *, dry_run: bool = False) -> dict[str, Any]:
    """Delete all user rows from a SQLite/SQLCipher-compatible file without dropping tables."""

    database_path = Path(path)
    if not database_path.is_file():
        raise FileNotFoundError(f"SQLite database does not exist: {database_path}")

    with sqlite3.connect(database_path) as connection:
        tables = _sqlite_tables(connection)
        before = {
            table: connection.execute(f"SELECT COUNT(*) FROM {_sqlite_identifier(table)}").fetchone()[0]
            for table in tables
        }
        if not dry_run:
            connection.execute("PRAGMA foreign_keys = OFF")
            for table in tables:
                connection.execute(f"DELETE FROM {_sqlite_identifier(table)}")
            connection.execute("PRAGMA foreign_keys = ON")
            connection.commit()
        after = {
            table: connection.execute(f"SELECT COUNT(*) FROM {_sqlite_identifier(table)}").fetchone()[0]
            for table in tables
        }
        schema_preserved = tables == _sqlite_tables(connection)

    return {
        "target": str(database_path),
        "kind": "sqlite",
        "dry_run": dry_run,
        "tables": len(tables),
        "rows_before": sum(before.values()),
        "rows_after": sum(after.values()),
        "schema_preserved": schema_preserved,
        "empty": dry_run or sum(after.values()) == 0,
    }


def clean_database(database_url: str, store_key: str = "canonical", *, dry_run: bool = False) -> dict[str, Any]:
    """Reset PostgreSQL application rows and the runtime snapshot without dropping tables."""

    try:
        import psycopg
        from psycopg import sql
    except ImportError as exc:
        raise RuntimeError("psycopg package is required to clean PostgreSQL database") from exc

    empty_store = PostgresCameraStore(database_url, store_key)
    empty_state_json = json.dumps(encode_store_state(empty_store))

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT tablename FROM pg_catalog.pg_tables "
                "WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys' ORDER BY tablename"
            )
            tables = [row[0] for row in cursor.fetchall()]
            if not dry_run and tables:
                identifiers = sql.SQL(", ").join(sql.Identifier("public", table) for table in tables)
                cursor.execute(sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(identifiers))
                cursor.execute(
                    """
                    INSERT INTO runtime_store_snapshots(store_key, state, revision, updated_at)
                    VALUES (%s, %s::jsonb, 0, now())
                    """,
                    (store_key, empty_state_json),
                )
            if not dry_run:
                connection.commit()

    return {
        "target": database_url,
        "kind": "postgresql",
        "dry_run": dry_run,
        "tables": len(tables),
        "schema_preserved": True,
        "empty": True,
        "store_key": store_key,
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--store-key", default="canonical")
    parser.add_argument("--desktop-manifest", action="append", default=[])
    parser.add_argument("--desktop-db", action="append", default=[])
    parser.add_argument("--yes", action="store_true", help="confirm destructive cleanup")
    parser.add_argument("--dry-run", action="store_true", help="report targets without modifying rows")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    manifest_paths = list(args.desktop_manifest)
    database_paths = list(args.desktop_db)
    if not manifest_paths and os.getenv("DESKTOP_MANIFEST_PATH"):
        manifest_paths.append(os.environ["DESKTOP_MANIFEST_PATH"])
    if not database_paths and os.getenv("DESKTOP_DB_PATH"):
        database_paths.append(os.environ["DESKTOP_DB_PATH"])
    if not args.database_url and not manifest_paths and not database_paths:
        parser.error("provide --database-url, --desktop-manifest, or --desktop-db")
    if not args.dry_run and not args.yes:
        parser.error("destructive cleanup requires --yes; use --dry-run to preview")

    reports: list[dict[str, Any]] = []
    if args.database_url:
        reports.append(clean_database(args.database_url, args.store_key, dry_run=args.dry_run))
    for path in [*manifest_paths, *database_paths]:
        reports.append(clean_sqlite_database(path, dry_run=args.dry_run))
    print(json.dumps({"dry_run": args.dry_run, "reports": reports}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
