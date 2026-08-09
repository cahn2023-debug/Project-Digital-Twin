use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

#[derive(Debug)]
pub enum SafeWriteError {
    Io(io::Error),
    FileConflict { expected: String, actual: String },
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

    fn initialize(&self) -> SqlResult<()> {
        self.connection.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS local_files (
               file_id TEXT PRIMARY KEY, logical_role TEXT NOT NULL,
               absolute_path TEXT NOT NULL, last_seen_at TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS sync_state (
               project_id TEXT PRIMARY KEY, last_server_revision INTEGER NOT NULL DEFAULT 0
             );
             CREATE TABLE IF NOT EXISTS pending_jobs (
               job_id TEXT PRIMARY KEY, job_type TEXT NOT NULL, payload TEXT NOT NULL,
               status TEXT NOT NULL, idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL
             );",
        )
    }
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
    std::fs::copy(path, &backup)?;
    let temporary = path.with_extension("project-digital-twin.tmp");
    std::fs::write(&temporary, replacement)?;
    let result = std::fs::rename(&temporary, path);
    if let Err(error) = result {
        let _ = std::fs::remove_file(&temporary);
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

#[cfg(test)]
mod tests {
    use super::{safe_replace, sha256_reader, ManifestDb, SafeWriteError};
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
}
