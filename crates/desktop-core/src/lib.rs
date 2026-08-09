use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug)]
pub enum SafeWriteError {
    Io(io::Error),
    FileConflict { expected: String, actual: String },
    FileLocked { path: String },
    EmptyReplacement,
}

impl From<io::Error> for SafeWriteError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

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
                file_version_from_row,
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

pub fn scan_directory(
    root: impl AsRef<Path>,
    extensions: &[&str],
) -> io::Result<Vec<DiscoveredFile>> {
    Ok(scan_directory_best_effort(root, extensions)?.0)
}

pub fn scan_directory_best_effort(
    root: impl AsRef<Path>,
    extensions: &[&str],
) -> io::Result<(Vec<DiscoveredFile>, Vec<ScanFailure>)> {
    let mut paths = Vec::new();
    collect_files(root.as_ref(), extensions, &mut paths)?;
    let mut files = Vec::with_capacity(paths.len());
    let mut failures = Vec::new();
    for path in paths {
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) => {
                failures.push(ScanFailure {
                    path: path.to_string_lossy().into_owned(),
                    error: error.to_string(),
                });
                continue;
            }
        };
        let (sha256, size) = match sha256_file(&path) {
            Ok(result) => result,
            Err(error) => {
                failures.push(ScanFailure {
                    path: path.to_string_lossy().into_owned(),
                    error: error.to_string(),
                });
                continue;
            }
        };
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_secs().to_string());
        files.push(DiscoveredFile {
            path: path.to_string_lossy().into_owned(),
            sha256,
            size,
            modified_at,
        });
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok((files, failures))
}

fn collect_files(root: &Path, extensions: &[&str], output: &mut Vec<PathBuf>) -> io::Result<()> {
    for entry in fs::read_dir(root)? {
        let path = entry?.path();
        if path.is_dir() {
            collect_files(&path, extensions, output)?;
            continue;
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if extensions
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(extension))
        {
            output.push(path);
        }
    }
    Ok(())
}

fn file_version_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileVersion> {
    Ok(FileVersion {
        file_version_id: row.get(0)?,
        file_id: row.get(1)?,
        revision: row.get(2)?,
        sha256: row.get(3)?,
        size: row.get::<_, i64>(4)? as u64,
        modified_at: row.get(5)?,
        created_at: row.get(6)?,
        status: row.get(7)?,
    })
}

pub fn sha256_reader(mut reader: impl Read) -> io::Result<(String, u64)> {
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut size = 0_u64;
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        size += read as u64;
    }
    Ok((format!("{:x}", hasher.finalize()), size))
}

pub fn sha256_file(path: impl AsRef<Path>) -> io::Result<(String, u64)> {
    sha256_reader(File::open(path)?)
}

/// Writes a verified replacement while preserving a sibling backup.
/// The Excel/profile layer validates replacement bytes before calling this primitive.
pub fn safe_replace(
    path: impl AsRef<Path>,
    expected_sha256: &str,
    replacement: &[u8],
) -> Result<ManifestEntry, SafeWriteError> {
    let path = path.as_ref();
    match OpenOptions::new().read(true).write(true).open(path) {
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            return Err(SafeWriteError::FileLocked {
                path: path.to_string_lossy().into_owned(),
            });
        }
        Err(error) => return Err(SafeWriteError::Io(error)),
    }
    let (actual_sha256, _) = sha256_file(path)?;
    if actual_sha256 != expected_sha256 {
        return Err(SafeWriteError::FileConflict {
            expected: expected_sha256.to_owned(),
            actual: actual_sha256,
        });
    }
    if replacement.is_empty() {
        return Err(SafeWriteError::EmptyReplacement);
    }

    let backup = path.with_extension(format!(
        "{}bak",
        path.extension()
            .and_then(|value| value.to_str())
            .map_or(String::new(), |value| format!("{}.", value))
    ));
    std::fs::copy(path, &backup).map_err(|error| {
        SafeWriteError::Io(io::Error::new(error.kind(), format!("backup: {error}")))
    })?;
    let temporary = path.with_extension("project-digital-twin.tmp");
    std::fs::write(&temporary, replacement).map_err(|error| {
        SafeWriteError::Io(io::Error::new(error.kind(), format!("temporary: {error}")))
    })?;
    sync_temporary(&temporary).map_err(|error| {
        SafeWriteError::Io(io::Error::new(
            error.kind(),
            format!("sync temporary: {error}"),
        ))
    })?;
    let result = atomic_replace(&temporary, path).or_else(|error| {
        #[cfg(windows)]
        if error.kind() == io::ErrorKind::PermissionDenied {
            // Some Windows file providers reject ReplaceFileW for files in a
            // temporary directory. Removing only after the atomic API fails
            // keeps the normal path atomic and still preserves lock checks.
            if std::fs::copy(&temporary, path).is_ok() {
                let _ = std::fs::remove_file(&temporary);
                return Ok(());
            }
            std::fs::remove_file(path)?;
            return std::fs::rename(&temporary, path);
        }
        Err(error)
    });
    if let Err(error) = result {
        let _ = std::fs::remove_file(&temporary);
        if error.kind() == io::ErrorKind::PermissionDenied {
            return Err(SafeWriteError::FileLocked {
                path: path.to_string_lossy().into_owned(),
            });
        }
        return Err(SafeWriteError::Io(error));
    }
    let (sha256, size) = sha256_file(path)?;
    Ok(ManifestEntry {
        logical_role: "MANAGED_FILE_MASTER".to_owned(),
        path: path.to_string_lossy().into_owned(),
        sha256,
        size,
    })
}

#[cfg(not(windows))]
fn atomic_replace(source: &Path, destination: &Path) -> io::Result<()> {
    std::fs::rename(source, destination)
}

#[cfg(not(windows))]
fn sync_temporary(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}

#[cfg(windows)]
fn sync_temporary(_path: &Path) -> io::Result<()> {
    // ReplaceFileW uses WRITE_THROUGH below; some Windows file providers
    // reject opening the temporary file for an explicit sync before replace.
    Ok(())
}

#[cfg(windows)]
fn atomic_replace(source: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const REPLACEFILE_WRITE_THROUGH: u32 = 0x0000_0001;

    #[link(name = "kernel32")]
    extern "system" {
        fn ReplaceFileW(
            replaced_file: *const u16,
            replacement_file: *const u16,
            backup_file: *const u16,
            replace_flags: u32,
            exclude: *mut std::ffi::c_void,
            reserved: *mut std::ffi::c_void,
        ) -> i32;
    }

    let replaced: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let replacement: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let moved = unsafe {
        ReplaceFileW(
            replaced.as_ptr(),
            replacement.as_ptr(),
            std::ptr::null(),
            REPLACEFILE_WRITE_THROUGH,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if moved == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        safe_replace, scan_directory, sha256_reader, DiscoveredFile, ManifestDb, SafeWriteError,
    };
    use std::io::Cursor;

    #[test]
    fn hashes_content_deterministically() {
        let (hash, size) = sha256_reader(Cursor::new(b"camera")).expect("hash");
        assert_eq!(size, 6);
        assert_eq!(
            hash,
            "89e8b9518d92279489bbdee26f3dc646d921d89a15afbd3a3e0ad695328a3da0"
        );
    }

    #[test]
    fn safe_replace_rejects_stale_source_hash() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("camera.xlsx");
        std::fs::write(&path, b"source").expect("source");
        let result = safe_replace(&path, "stale", b"replacement");
        assert!(matches!(result, Err(SafeWriteError::FileConflict { .. })));
        assert_eq!(std::fs::read(&path).expect("read"), b"source");
    }

    #[test]
    fn safe_replace_creates_backup_and_self_write_marker_suppresses_scan() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("camera.xlsx");
        std::fs::write(&path, b"source").expect("source");
        let (expected, _) = super::sha256_file(&path).expect("hash");
        let result = safe_replace(&path, &expected, b"replacement").expect("replace");
        assert_eq!(std::fs::read(&path).expect("read"), b"replacement");
        assert_eq!(
            std::fs::read(path.with_extension("xlsx.bak")).expect("backup"),
            b"source"
        );

        let database = ManifestDb::open_in_memory().expect("manifest");
        database
            .record_self_write(&result.path, &result.sha256, "write-1", "now")
            .expect("marker");
        let discovered = DiscoveredFile {
            path: result.path,
            sha256: result.sha256,
            size: result.size,
            modified_at: None,
        };
        assert!(!database
            .enqueue_file_scan(&discovered, "later")
            .expect("scan"));
    }

    #[test]
    fn manifest_persists_file_cursor_and_pending_job() {
        let database = ManifestDb::open_in_memory().expect("manifest");
        database
            .upsert_file("file-1", "CAMERA_MASTER", "C:/Data/Camera.xlsx", "now")
            .expect("file");
        database.set_sync_cursor("project-1", 7).expect("cursor");
        database
            .enqueue_job("job-1", "FILE_WRITE", "{}", "idempotency-1", "now")
            .expect("job");
        assert_eq!(database.sync_cursor("project-1").expect("read cursor"), 7);
        assert_eq!(database.sync_cursor("unknown").expect("missing cursor"), 0);
    }

    #[test]
    fn manifest_registers_immutable_versions_and_raw_records() {
        let database = ManifestDb::open_in_memory().expect("manifest");
        database
            .upsert_file("file-1", "CAMERA_MASTER", "C:/Data/Camera.xlsx", "now")
            .expect("file");

        let first = database
            .register_file_version("version-1", "file-1", "hash-1", 10, Some("mtime-1"), "now")
            .expect("version")
            .expect("new version");
        assert_eq!(first.revision, 1);
        assert!(database
            .register_file_version(
                "duplicate",
                "file-1",
                "hash-1",
                10,
                Some("mtime-1"),
                "later"
            )
            .expect("duplicate check")
            .is_none());

        let second = database
            .register_file_version(
                "version-2",
                "file-1",
                "hash-2",
                12,
                Some("mtime-2"),
                "later",
            )
            .expect("version")
            .expect("new version");
        assert_eq!(second.revision, 2);
        database
            .store_raw_record(
                "raw-1",
                "version-2",
                "row-4",
                r#"{"CameraCode":"CAM-001"}"#,
                r#"{"sheet":"CAMERA","row":4,"column":"A"}"#,
            )
            .expect("raw record");

        let raw = database
            .raw_record("raw-1")
            .expect("raw read")
            .expect("raw");
        assert_eq!(raw.file_version_id, "version-2");
        assert_eq!(raw.row_key, "row-4");
        assert_eq!(
            database
                .latest_file_version("file-1")
                .expect("latest")
                .expect("version")
                .revision,
            2
        );
    }

    #[test]
    fn manifest_cleanup_keeps_latest_local_version_and_moved_path_keeps_identity() {
        let directory = tempfile::tempdir().expect("tempdir");
        let database_path = directory.path().join("manifest.sqlite");
        {
            let database = ManifestDb::open(&database_path).expect("manifest");
            database
                .upsert_file("file-1", "CAMERA_MASTER", "C:/old/Camera.xlsx", "now")
                .expect("file");
            database
                .register_file_version("version-1", "file-1", "hash-1", 10, None, "now")
                .expect("version")
                .expect("new version");
            database
                .register_file_version("version-2", "file-1", "hash-2", 12, None, "later")
                .expect("version")
                .expect("new version");
            database
                .upsert_file("file-1", "CAMERA_MASTER", "D:/moved/Camera.xlsx", "later")
                .expect("moved file");
            assert_eq!(
                database
                    .cleanup_local_versions_after_server_ack("file-1", 2, 1)
                    .expect("not acknowledged"),
                0
            );
            assert_eq!(
                database
                    .cleanup_local_versions_after_server_ack("file-1", 2, 2)
                    .expect("cleanup"),
                1
            );
        }

        let reopened = ManifestDb::open(&database_path).expect("reopen");
        let latest = reopened
            .latest_file_version("file-1")
            .expect("latest")
            .expect("version");
        assert_eq!(latest.revision, 2);
        assert_eq!(latest.file_id, "file-1");
    }

    #[test]
    fn scanner_debounces_files_and_enqueues_idempotently() {
        let directory = tempfile::tempdir().expect("tempdir");
        let nested = directory.path().join("nested");
        std::fs::create_dir_all(&nested).expect("nested");
        let path = nested.join("camera.xlsx");
        std::fs::write(&path, b"camera").expect("file");

        let files = scan_directory(directory.path(), &["xlsx"]).expect("scan");
        assert_eq!(files.len(), 1);
        let database = ManifestDb::open_in_memory().expect("manifest");
        let file = &files[0];
        assert!(!database
            .observe_file(
                &file.path,
                file.size,
                file.modified_at.as_deref(),
                &file.sha256,
                10,
                5
            )
            .expect("first observation"));
        assert!(database
            .observe_file(
                &file.path,
                file.size,
                file.modified_at.as_deref(),
                &file.sha256,
                15,
                5
            )
            .expect("stable observation"));
        assert!(database.enqueue_file_scan(file, "now").expect("enqueue"));
        assert!(!database
            .enqueue_file_scan(file, "later")
            .expect("duplicate enqueue"));
    }

    #[test]
    fn retry_state_becomes_failed_after_max_attempts() {
        let database = ManifestDb::open_in_memory().expect("manifest");
        let file = DiscoveredFile {
            path: "C:/Data/Camera.xlsx".to_owned(),
            sha256: "hash".to_owned(),
            size: 10,
            modified_at: None,
        };
        database.enqueue_file_scan(&file, "now").expect("enqueue");
        assert!(database
            .record_job_failure("FILE_SCAN:hash:C:/Data/Camera.xlsx", "locked", 20, 2)
            .expect("retry"));
        assert!(!database
            .record_job_failure("FILE_SCAN:hash:C:/Data/Camera.xlsx", "locked", 40, 2)
            .expect("failed"));
        assert_eq!(
            database
                .job_status("FILE_SCAN:hash:C:/Data/Camera.xlsx")
                .expect("status")
                .expect("job"),
            ("FAILED".to_owned(), 2)
        );
    }

    #[test]
    fn unreadable_file_failures_enter_the_retry_queue() {
        let database = ManifestDb::open_in_memory().expect("manifest");
        assert!(database
            .enqueue_file_failure("C:/Data/Locked.xlsx", "file is locked", "now")
            .expect("failure job"));
        assert_eq!(
            database
                .job_status("FILE_SCAN_PATH:C:/Data/Locked.xlsx")
                .expect("status")
                .expect("job"),
            ("RETRY".to_owned(), 1)
        );
    }
}
