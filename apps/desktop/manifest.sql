PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS local_files (
    file_id TEXT PRIMARY KEY,
    logical_role TEXT NOT NULL,
    absolute_path TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_hash_cache (
    file_id TEXT PRIMARY KEY REFERENCES local_files(file_id),
    sha256 TEXT NOT NULL,
    size INTEGER NOT NULL,
    modified_at TEXT,
    scanned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
    project_id TEXT PRIMARY KEY,
    last_server_revision INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pending_jobs (
    job_id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cached_entities (
    entity_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    server_revision INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS desktop_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
