use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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
pub struct SourceRegistration {
    pub source_id: String,
    pub project_id: String,
    pub directory: String,
    pub status: String,
    pub watcher_enabled: bool,
    pub debounce_seconds: i64,
    pub registered_at: String,
    pub updated_at: String,
    pub last_scan_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileScanContext {
    pub file_id: String,
    pub file_version_id: String,
    pub file_revision: i64,
    pub path: String,
    pub sha256: String,
    pub size: u64,
    pub modified_at: Option<String>,
}

pub fn source_id_for_directory(project_id: &str, directory: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(project_id.as_bytes());
    hasher.update([0]);
    hasher.update(directory.as_bytes());
    format!("source-{:x}", hasher.finalize())
}

pub fn file_id_for_path(path: &str) -> String {
    let digest = source_id_for_directory("file", path)
        .trim_start_matches("source-")
        .to_owned();
    format!(
        "{}-{}-{}-{}-{}",
        &digest[0..8],
        &digest[8..12],
        &digest[12..16],
        &digest[16..20],
        &digest[20..32]
    )
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LocalImport {
    pub import_id: String,
    pub project_id: String,
    pub file_version_id: String,
    pub status: String,
    pub payload: String,
    pub created_at: String,
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

    pub fn register_source(
        &self,
        project_id: &str,
        directory: &str,
        debounce_seconds: i64,
        registered_at: &str,
    ) -> SqlResult<SourceRegistration> {
        let source_id = source_id_for_directory(project_id, directory);
        self.connection.execute(
            "INSERT INTO source_registrations(
               source_id, project_id, directory, status, watcher_enabled,
               debounce_seconds, registered_at, updated_at
             ) VALUES (?1, ?2, ?3, 'REGISTERED', 0, ?4, ?5, ?5)
             ON CONFLICT(project_id, directory) DO UPDATE SET
               status='REGISTERED', debounce_seconds=excluded.debounce_seconds,
               updated_at=excluded.updated_at, last_error=NULL",
            params![
                source_id,
                project_id,
                directory,
                debounce_seconds.max(1),
                registered_at
            ],
        )?;
        self.source_registration(&source_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn source_registration(&self, source_id: &str) -> SqlResult<Option<SourceRegistration>> {
        self.connection
            .query_row(
                "SELECT source_id, project_id, directory, status, watcher_enabled,
                        debounce_seconds, registered_at, updated_at, last_scan_at, last_error
                 FROM source_registrations WHERE source_id = ?1",
                params![source_id],
                source_registration_from_row,
            )
            .optional()
    }

    pub fn list_sources(&self, project_id: &str) -> SqlResult<Vec<SourceRegistration>> {
        let mut statement = self.connection.prepare(
            "SELECT source_id, project_id, directory, status, watcher_enabled,
                    debounce_seconds, registered_at, updated_at, last_scan_at, last_error
             FROM source_registrations WHERE project_id = ?1 ORDER BY directory",
        )?;
        let rows = statement.query_map(params![project_id], source_registration_from_row)?;
        rows.collect()
    }

    pub fn set_source_watcher_enabled(
        &self,
        source_id: &str,
        enabled: bool,
        updated_at: &str,
    ) -> SqlResult<bool> {
        Ok(self.connection.execute(
            "UPDATE source_registrations
             SET watcher_enabled = ?2, updated_at = ?3
             WHERE source_id = ?1",
            params![source_id, i64::from(enabled), updated_at],
        )? == 1)
    }

    pub fn record_source_scan(
        &self,
        source_id: &str,
        scan_at: &str,
        error: Option<&str>,
    ) -> SqlResult<bool> {
        let status = if error.is_some() {
            "FAILED"
        } else {
            "REGISTERED"
        };
        Ok(self.connection.execute(
            "UPDATE source_registrations
             SET status = ?2, last_scan_at = ?3, last_error = ?4, updated_at = ?3
             WHERE source_id = ?1",
            params![source_id, status, scan_at, error],
        )? == 1)
    }

    pub fn enqueue_file_scan_for_source(
        &self,
        source_id: &str,
        file: &DiscoveredFile,
        created_at: &str,
    ) -> SqlResult<bool> {
        if self.is_self_write(&file.path, &file.sha256)? {
            return Ok(false);
        }
        let source = self
            .source_registration(source_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let file_id = file_id_for_path(&file.path);
        let idempotency_key = format!("FILE_SCAN:{}:{}:{}", source_id, file.sha256, file.path);
        let payload = serde_json::json!({
            "source_id": source_id,
            "project_id": source.project_id,
            "file_id": file_id,
            "path": file.path,
            "sha256": file.sha256,
            "size": file.size,
            "modified_at": file.modified_at,
        })
        .to_string();
        let inserted = self.connection.execute(
            "INSERT OR IGNORE INTO pending_jobs(job_id, job_type, payload, status, idempotency_key, created_at)
             VALUES (?1, 'FILE_SCAN', ?2, 'PENDING', ?1, ?3)",
            params![idempotency_key, payload, created_at],
        )?;
        Ok(inserted == 1)
    }

    pub fn register_scanned_file(
        &self,
        file: &DiscoveredFile,
        created_at: &str,
    ) -> SqlResult<FileScanContext> {
        let file_id = file_id_for_path(&file.path);
        self.upsert_file(&file_id, "SOURCE", &file.path, created_at)?;
        let file_version_id = source_id_for_directory(&file_id, &file.sha256);
        let version = match self.register_file_version(
            &file_version_id,
            &file_id,
            &file.sha256,
            file.size,
            file.modified_at.as_deref(),
            created_at,
        )? {
            Some(version) => version,
            None => self
                .latest_file_version(&file_id)?
                .ok_or(rusqlite::Error::QueryReturnedNoRows)?,
        };
        Ok(FileScanContext {
            file_id,
            file_version_id: version.file_version_id,
            file_revision: version.revision,
            path: file.path.clone(),
            sha256: file.sha256.clone(),
            size: file.size,
            modified_at: file.modified_at.clone(),
        })
    }

    pub fn store_local_import_result(
        &self,
        import_id: &str,
        project_id: &str,
        file_version_id: &str,
        status: &str,
        payload: &str,
        created_at: &str,
        raw_records: &[RawRecord],
    ) -> SqlResult<()> {
        self.connection.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            self.connection.execute(
                "INSERT OR REPLACE INTO local_imports(
                   import_id, project_id, file_version_id, status, payload, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    import_id,
                    project_id,
                    file_version_id,
                    status,
                    payload,
                    created_at
                ],
            )?;
            for raw in raw_records {
                self.connection.execute(
                    "INSERT OR REPLACE INTO raw_records(
                       raw_id, file_version_id, row_key, payload, source_locator
                     ) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        raw.raw_id,
                        raw.file_version_id,
                        raw.row_key,
                        raw.payload,
                        raw.source_locator
                    ],
                )?;
            }
            Ok(())
        })();
        match result {
            Ok(()) => {
                self.connection.execute_batch("COMMIT")?;
                Ok(())
            }
            Err(error) => {
                let _ = self.connection.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn local_import(
        &self,
        import_id: &str,
    ) -> SqlResult<Option<(String, String, String, String)>> {
        self.connection
            .query_row(
                "SELECT project_id, file_version_id, status, payload
                 FROM local_imports WHERE import_id = ?1",
                params![import_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()
    }

    pub fn list_local_imports(&self, project_id: &str) -> SqlResult<Vec<LocalImport>> {
        let mut statement = self.connection.prepare(
            "SELECT import_id, project_id, file_version_id, status, payload, created_at
             FROM local_imports WHERE project_id = ?1 ORDER BY created_at DESC, import_id",
        )?;
        let rows = statement.query_map(params![project_id], |row| {
            Ok(LocalImport {
                import_id: row.get(0)?,
                project_id: row.get(1)?,
                file_version_id: row.get(2)?,
                status: row.get(3)?,
                payload: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn save_local_profile(
        &self,
        profile_id: &str,
        project_id: &str,
        version: i64,
        payload: &str,
        created_at: &str,
    ) -> SqlResult<bool> {
        let inserted = self.connection.execute(
            "INSERT OR IGNORE INTO local_profiles(
               profile_id, project_id, version, payload, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![profile_id, project_id, version, payload, created_at],
        )?;
        Ok(inserted == 1)
    }

    pub fn raw_records_for_version(&self, file_version_id: &str) -> SqlResult<Vec<RawRecord>> {
        let mut statement = self.connection.prepare(
            "SELECT raw_id, file_version_id, row_key, payload, source_locator
             FROM raw_records WHERE file_version_id = ?1 ORDER BY row_key",
        )?;
        let rows = statement.query_map(params![file_version_id], |row| {
            Ok(RawRecord {
                raw_id: row.get(0)?,
                file_version_id: row.get(1)?,
                row_key: row.get(2)?,
                payload: row.get(3)?,
                source_locator: row.get(4)?,
            })
        })?;
        rows.collect()
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
             CREATE TABLE IF NOT EXISTS source_registrations (
               source_id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
               directory TEXT NOT NULL, status TEXT NOT NULL,
               watcher_enabled INTEGER NOT NULL DEFAULT 0,
               debounce_seconds INTEGER NOT NULL DEFAULT 5,
               registered_at TEXT NOT NULL, updated_at TEXT NOT NULL,
               last_scan_at TEXT, last_error TEXT,
               UNIQUE(project_id, directory)
             );
             CREATE TABLE IF NOT EXISTS local_imports (
               import_id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
               file_version_id TEXT NOT NULL, status TEXT NOT NULL,
               payload TEXT NOT NULL, created_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS local_profiles (
               profile_id TEXT NOT NULL, project_id TEXT NOT NULL,
               version INTEGER NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
               PRIMARY KEY(profile_id, version)
             );
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

fn source_registration_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SourceRegistration> {
    Ok(SourceRegistration {
        source_id: row.get(0)?,
        project_id: row.get(1)?,
        directory: row.get(2)?,
        status: row.get(3)?,
        watcher_enabled: row.get::<_, i64>(4)? != 0,
        debounce_seconds: row.get(5)?,
        registered_at: row.get(6)?,
        updated_at: row.get(7)?,
        last_scan_at: row.get(8)?,
        last_error: row.get(9)?,
    })
}
