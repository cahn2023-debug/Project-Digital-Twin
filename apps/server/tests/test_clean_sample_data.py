from __future__ import annotations

import json
import sqlite3

import pytest

from app.clean_sample_data import clean_sqlite_database, main


def create_sample_database(path) -> None:
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE cameras (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, code TEXT NOT NULL);
            INSERT INTO projects(id, name) VALUES (1, 'Sample project');
            INSERT INTO cameras(id, project_id, code) VALUES (1, 1, 'CAM-SAMPLE');
            """
        )


def test_clean_sqlite_database_removes_rows_and_preserves_schema(tmp_path) -> None:
    database_path = tmp_path / "manifest.db"
    create_sample_database(database_path)

    report = clean_sqlite_database(str(database_path))

    assert report["rows_before"] == 2
    assert report["rows_after"] == 0
    assert report["schema_preserved"] is True
    with sqlite3.connect(database_path) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert tables == {"projects", "cameras"}


def test_clean_sqlite_database_dry_run_does_not_mutate(tmp_path) -> None:
    database_path = tmp_path / "manifest.db"
    create_sample_database(database_path)

    report = clean_sqlite_database(str(database_path), dry_run=True)

    assert report["dry_run"] is True
    assert report["rows_before"] == 2
    assert report["rows_after"] == 2
    with sqlite3.connect(database_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 1


def test_cli_requires_explicit_confirmation_for_destructive_cleanup(tmp_path) -> None:
    database_path = tmp_path / "manifest.db"
    create_sample_database(database_path)

    with pytest.raises(SystemExit):
        main(["--desktop-manifest", str(database_path)])


def test_cli_cleans_desktop_manifest_and_reports_json(tmp_path, capsys) -> None:
    database_path = tmp_path / "manifest.db"
    create_sample_database(database_path)

    assert main(["--desktop-manifest", str(database_path), "--yes"]) == 0
    output = json.loads(capsys.readouterr().out)

    assert output["reports"][0]["kind"] == "sqlite"
    assert output["reports"][0]["empty"] is True
