PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source_registrations (
    source_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    directory TEXT NOT NULL,
    status TEXT NOT NULL,
    watcher_enabled INTEGER NOT NULL DEFAULT 0,
    debounce_seconds INTEGER NOT NULL DEFAULT 5,
    registered_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_scan_at TEXT,
    last_error TEXT,
    UNIQUE(project_id, directory)
);

CREATE TABLE IF NOT EXISTS local_imports (
    import_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_profiles (
    profile_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(profile_id, version)
);

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

CREATE TABLE IF NOT EXISTS file_versions (
    file_version_id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES local_files(file_id),
    revision INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    size INTEGER NOT NULL,
    modified_at TEXT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    UNIQUE(file_id, revision),
    UNIQUE(file_id, sha256)
);

CREATE TABLE IF NOT EXISTS raw_records (
    raw_id TEXT PRIMARY KEY,
    file_version_id TEXT NOT NULL REFERENCES file_versions(file_version_id) ON DELETE CASCADE,
    row_key TEXT NOT NULL,
    payload TEXT NOT NULL,
    source_locator TEXT NOT NULL,
    UNIQUE(file_version_id, row_key)
);

CREATE TABLE IF NOT EXISTS file_observations (
    path TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    modified_at TEXT,
    sha256 TEXT NOT NULL,
    stable_since INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS job_attempts (
    job_id TEXT PRIMARY KEY REFERENCES pending_jobs(job_id) ON DELETE CASCADE,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER NOT NULL,
    last_error TEXT
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

CREATE TABLE IF NOT EXISTS self_write_markers (
    path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    write_job_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(path, sha256)
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
