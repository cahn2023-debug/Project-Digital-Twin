use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManifestEntry {
    pub logical_role: String,
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileVersion {
    pub file_version_id: String,
    pub file_id: String,
    pub revision: i64,
    pub sha256: String,
    pub size: u64,
    pub modified_at: Option<String>,
    pub created_at: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RawRecord {
    pub raw_id: String,
    pub file_version_id: String,
    pub row_key: String,
    pub payload: String,
    pub source_locator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredFile {
    pub path: String,
    pub sha256: String,
    pub size: u64,
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScanFailure {
    pub path: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PendingJob {
    pub job_id: String,
    pub job_type: String,
    pub payload: String,
    pub status: String,
    pub idempotency_key: Option<String>,
    pub created_at: String,
    pub attempts: i64,
    pub next_retry_at: i64,
    pub last_error: Option<String>,
}

pub struct ManifestDb {
    connection: Connection,
}

impl ManifestDb {
    pub fn open(path: impl AsRef<Path>) -> SqlResult<Self> {
        let connection = Connection::open(path)?;
        let database = Self { connection };
        database.initialize()?;
        Ok(database)
    }

    pub fn open_in_memory() -> SqlResult<Self> {
        let connection = Connection::open_in_memory()?;
        let database = Self { connection };
        database.initialize()?;
        Ok(database)
    }

    pub fn upsert_file(
        &self,
        file_id: &str,
        logical_role: &str,
        path: &str,
        last_seen_at: &str,
    ) -> SqlResult<()> {
        self.connection.execute(
            "INSERT INTO local_files(file_id, logical_role, absolute_path, last_seen_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(file_id) DO UPDATE SET logical_role=excluded.logical_role,
               absolute_path=excluded.absolute_path, last_seen_at=excluded.last_seen_at",
            params![file_id, logical_role, path, last_seen_at],
        )?;
        Ok(())
    }

    pub fn set_sync_cursor(&self, project_id: &str, cursor: i64) -> SqlResult<()> {
        self.connection.execute(
            "INSERT INTO sync_state(project_id, last_server_revision) VALUES (?1, ?2)
             ON CONFLICT(project_id) DO UPDATE SET last_server_revision=excluded.last_server_revision",
            params![project_id, cursor],
        )?;
        Ok(())
    }

    pub fn sync_cursor(&self, project_id: &str) -> SqlResult<i64> {
        self.connection
            .query_row(
                "SELECT last_server_revision FROM sync_state WHERE project_id = ?1",
                params![project_id],
                |row| row.get(0),
            )
            .or_else(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => Ok(0),
                other => Err(other),
            })
    }

    pub fn enqueue_job(
        &self,
        job_id: &str,
        job_type: &str,
        payload: &str,
        idempotency_key: &str,
        created_at: &str,
    ) -> SqlResult<()> {
        self.connection.execute(
            "INSERT INTO pending_jobs(job_id, job_type, payload, status, idempotency_key, created_at)
             VALUES (?1, ?2, ?3, 'PENDING', ?4, ?5)",
            params![job_id, job_type, payload, idempotency_key, created_at],
        )?;
        Ok(())
    }

    pub fn observe_file(
        &self,
        path: &str,
        size: u64,
        modified_at: Option<&str>,
        sha256: &str,
        observed_at: i64,
        debounce_seconds: i64,
    ) -> SqlResult<bool> {
        let previous: Option<(i64, Option<String>, String)> = self
            .connection
            .query_row(
                "SELECT stable_since, modified_at, sha256 FROM file_observations WHERE path = ?1",
                params![path],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;
        match previous {
            Some((stable_since, previous_modified_at, previous_sha256))
                if previous_modified_at.as_deref() == modified_at && previous_sha256 == sha256 =>
            {
                Ok(observed_at - stable_since >= debounce_seconds)
            }
            _ => {
                self.connection.execute(
                    "INSERT INTO file_observations(path, size, modified_at, sha256, stable_since)
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(path) DO UPDATE SET size=excluded.size,
                       modified_at=excluded.modified_at, sha256=excluded.sha256,
                       stable_since=excluded.stable_since",
                    params![path, size as i64, modified_at, sha256, observed_at],
                )?;
                Ok(false)
            }
        }
    }

    pub fn enqueue_file_scan(&self, file: &DiscoveredFile, created_at: &str) -> SqlResult<bool> {
        if self.is_self_write(&file.path, &file.sha256)? {
            return Ok(false);
        }
        let idempotency_key = format!("FILE_SCAN:{}:{}", file.sha256, file.path);
        let inserted = self.connection.execute(
            "INSERT OR IGNORE INTO pending_jobs(job_id, job_type, payload, status, idempotency_key, created_at)
             VALUES (?1, 'FILE_SCAN', ?2, 'PENDING', ?1, ?3)",
            params![
                idempotency_key,
                format!("path={};sha256={};size={}", file.path, file.sha256, file.size),
                created_at
            ],
        )?;
        Ok(inserted == 1)
    }

    pub fn record_self_write(
        &self,
        path: &str,
        sha256: &str,
        write_job_id: &str,
        created_at: &str,
    ) -> SqlResult<()> {
        self.connection.execute(
            "INSERT OR REPLACE INTO self_write_markers(path, sha256, write_job_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![path, sha256, write_job_id, created_at],
        )?;
        Ok(())
    }

    pub fn is_self_write(&self, path: &str, sha256: &str) -> SqlResult<bool> {
        Ok(self
            .connection
            .query_row(
                "SELECT 1 FROM self_write_markers WHERE path = ?1 AND sha256 = ?2",
                params![path, sha256],
                |_row| Ok(()),
            )
            .optional()?
            .is_some())
    }

    pub fn enqueue_file_failure(
        &self,
        path: &str,
        error: &str,
        created_at: &str,
    ) -> SqlResult<bool> {
        let job_id = format!("FILE_SCAN_PATH:{path}");
        let inserted = self.connection.execute(
            "INSERT OR IGNORE INTO pending_jobs(job_id, job_type, payload, status, idempotency_key, created_at)
             VALUES (?1, 'FILE_SCAN', ?2, 'PENDING', ?1, ?3)",
            params![job_id, format!("path={path}"), created_at],
        )?;
        self.record_job_failure(&job_id, error, 0, 3)?;
        Ok(inserted == 1)
    }

    pub fn record_job_failure(
        &self,
        job_id: &str,
        error: &str,
        next_retry_at: i64,
        max_attempts: i64,
    ) -> SqlResult<bool> {
        self.connection.execute(
            "INSERT INTO job_attempts(job_id, attempts, next_retry_at, last_error)
             VALUES (?1, 1, ?2, ?3)
             ON CONFLICT(job_id) DO UPDATE SET attempts=attempts + 1,
               next_retry_at=excluded.next_retry_at, last_error=excluded.last_error",
            params![job_id, next_retry_at, error],
        )?;
        let attempts: i64 = self.connection.query_row(
            "SELECT attempts FROM job_attempts WHERE job_id = ?1",
            params![job_id],
            |row| row.get(0),
        )?;
        let status = if attempts >= max_attempts {
            "FAILED"
        } else {
            "RETRY"
        };
        self.connection.execute(
            "UPDATE pending_jobs SET status = ?2 WHERE job_id = ?1",
            params![job_id, status],
        )?;
        Ok(status == "RETRY")
    }

    pub fn job_status(&self, job_id: &str) -> SqlResult<Option<(String, i64)>> {
        self.connection
            .query_row(
                "SELECT pending_jobs.status, COALESCE(job_attempts.attempts, 0)
                 FROM pending_jobs LEFT JOIN job_attempts ON job_attempts.job_id = pending_jobs.job_id
                 WHERE pending_jobs.job_id = ?1",
                params![job_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
    }

    pub fn claim_next_job(&self, now: i64) -> SqlResult<Option<PendingJob>> {
        self.connection.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let pending: Option<String> = self
                .connection
                .query_row(
                    "SELECT pending_jobs.job_id
                     FROM pending_jobs
                     LEFT JOIN job_attempts ON job_attempts.job_id = pending_jobs.job_id
                     WHERE pending_jobs.status IN ('PENDING', 'RETRY')
                       AND COALESCE(job_attempts.next_retry_at, 0) <= ?1
                     ORDER BY pending_jobs.created_at, pending_jobs.job_id
                     LIMIT 1",
                    params![now],
                    |row| row.get(0),
                )
                .optional()?;
            let Some(job_id) = pending else {
                return Ok(None);
            };
            self.connection.execute(
                "UPDATE pending_jobs SET status = 'PROCESSING' WHERE job_id = ?1",
                params![job_id],
            )?;
            self.connection
                .query_row(
                    "SELECT pending_jobs.job_id, pending_jobs.job_type, pending_jobs.payload,
                            pending_jobs.status, pending_jobs.idempotency_key, pending_jobs.created_at,
                            COALESCE(job_attempts.attempts, 0), COALESCE(job_attempts.next_retry_at, 0),
                            job_attempts.last_error
                     FROM pending_jobs
                     LEFT JOIN job_attempts ON job_attempts.job_id = pending_jobs.job_id
                     WHERE pending_jobs.job_id = ?1",
                    params![job_id],
                    |row| {
                        Ok(PendingJob {
                            job_id: row.get(0)?,
                            job_type: row.get(1)?,
                            payload: row.get(2)?,
                            status: row.get(3)?,
                            idempotency_key: row.get(4)?,
                            created_at: row.get(5)?,
                            attempts: row.get(6)?,
                            next_retry_at: row.get(7)?,
                            last_error: row.get(8)?,
                        })
                    },
                )
                .map(Some)
        })();
        match result {
            Ok(value) => {
                self.connection.execute_batch("COMMIT")?;
                Ok(value)
            }
            Err(error) => {
                let _ = self.connection.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn complete_job(&self, job_id: &str) -> SqlResult<bool> {
        Ok(self.connection.execute(
            "UPDATE pending_jobs SET status = 'DONE' WHERE job_id = ?1 AND status = 'PROCESSING'",
            params![job_id],
        )? == 1)
    }

    pub fn retry_job(
        &self,
        job_id: &str,
        error: &str,
        next_retry_at: i64,
        max_attempts: i64,
    ) -> SqlResult<bool> {
        self.record_job_failure(job_id, error, next_retry_at, max_attempts)
    }

    pub fn register_file_version(
        &self,
        file_version_id: &str,
        file_id: &str,
        sha256: &str,
        size: u64,
        modified_at: Option<&str>,
        created_at: &str,
    ) -> SqlResult<Option<FileVersion>> {
        let existing = self
            .connection
            .query_row(
                "SELECT revision FROM file_versions WHERE file_id = ?1 AND sha256 = ?2",
                params![file_id, sha256],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        if existing.is_some() {
            return Ok(None);
        }

        let revision = self.connection.query_row(
            "SELECT COALESCE(MAX(revision), 0) + 1 FROM file_versions WHERE file_id = ?1",
            params![file_id],
            |row| row.get::<_, i64>(0),
        )?;
        self.connection.execute(
            "INSERT INTO file_versions(
               file_version_id, file_id, revision, sha256, size, modified_at, created_at, status
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'DISCOVERED')",
            params![
                file_version_id,
                file_id,
                revision,
                sha256,
                size as i64,
                modified_at,
                created_at
            ],
        )?;

        Ok(Some(FileVersion {
            file_version_id: file_version_id.to_owned(),
            file_id: file_id.to_owned(),
            revision,
            sha256: sha256.to_owned(),
            size,
            modified_at: modified_at.map(str::to_owned),
            created_at: created_at.to_owned(),
            status: "DISCOVERED".to_owned(),
        }))
    }

    pub fn latest_file_version(&self, file_id: &str) -> SqlResult<Option<FileVersion>> {
        self.connection
            .query_row(
                "SELECT file_version_id, file_id, revision, sha256, size,
                        modified_at, created_at, status
                 FROM file_versions
                 WHERE file_id = ?1
                 ORDER BY revision DESC
                 LIMIT 1",
                params![file_id],
                super::scanner::file_version_from_row,
            )
            .optional()
    }

    pub fn store_raw_record(
        &self,
        raw_id: &str,
        file_version_id: &str,
        row_key: &str,
        payload: &str,
        source_locator: &str,
    ) -> SqlResult<()> {
        self.connection.execute(
            "INSERT INTO raw_records(raw_id, file_version_id, row_key, payload, source_locator)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![raw_id, file_version_id, row_key, payload, source_locator],
        )?;
        Ok(())
    }

    pub fn raw_record(&self, raw_id: &str) -> SqlResult<Option<RawRecord>> {
        self.connection
            .query_row(
                "SELECT raw_id, file_version_id, row_key, payload, source_locator
                 FROM raw_records WHERE raw_id = ?1",
                params![raw_id],
                |row| {
                    Ok(RawRecord {
                        raw_id: row.get(0)?,
                        file_version_id: row.get(1)?,
                        row_key: row.get(2)?,
                        payload: row.get(3)?,
                        source_locator: row.get(4)?,
                    })
                },
            )
            .optional()
    }

    pub fn cleanup_local_versions(&self, file_id: &str, keep_revision: i64) -> SqlResult<usize> {
        self.connection.execute(
            "DELETE FROM file_versions WHERE file_id = ?1 AND revision < ?2",
            params![file_id, keep_revision],
        )
    }

    pub fn cleanup_local_versions_after_server_ack(
        &self,
        file_id: &str,
        keep_revision: i64,
        acknowledged_revision: i64,
    ) -> SqlResult<usize> {
        if acknowledged_revision < keep_revision {
            return Ok(0);
        }
        self.cleanup_local_versions(file_id, keep_revision)
    }

    fn initialize(&self) -> SqlResult<()> {
        self.connection.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS local_files (
               file_id TEXT PRIMARY KEY, logical_role TEXT NOT NULL,
               absolute_path TEXT NOT NULL, last_seen_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS file_versions (
               file_version_id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES local_files(file_id),
               revision INTEGER NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL,
               modified_at TEXT, created_at TEXT NOT NULL, status TEXT NOT NULL,
               UNIQUE(file_id, revision), UNIQUE(file_id, sha256)
             );
             CREATE TABLE IF NOT EXISTS raw_records (
               raw_id TEXT PRIMARY KEY,
               file_version_id TEXT NOT NULL REFERENCES file_versions(file_version_id) ON DELETE CASCADE,
               row_key TEXT NOT NULL, payload TEXT NOT NULL, source_locator TEXT NOT NULL,
               UNIQUE(file_version_id, row_key)
             );
             CREATE TABLE IF NOT EXISTS file_observations (
               path TEXT PRIMARY KEY, size INTEGER NOT NULL, modified_at TEXT,
               sha256 TEXT NOT NULL, stable_since INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS job_attempts (
               job_id TEXT PRIMARY KEY REFERENCES pending_jobs(job_id) ON DELETE CASCADE,
               attempts INTEGER NOT NULL DEFAULT 0, next_retry_at INTEGER NOT NULL,
               last_error TEXT
             );
             CREATE TABLE IF NOT EXISTS sync_state (
               project_id TEXT PRIMARY KEY, last_server_revision INTEGER NOT NULL DEFAULT 0
             );
             CREATE TABLE IF NOT EXISTS pending_jobs (
               job_id TEXT PRIMARY KEY, job_type TEXT NOT NULL, payload TEXT NOT NULL,
               status TEXT NOT NULL, idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS self_write_markers (
               path TEXT NOT NULL, sha256 TEXT NOT NULL, write_job_id TEXT NOT NULL,
               created_at TEXT NOT NULL, PRIMARY KEY(path, sha256)
             );",
        )
    }
}
