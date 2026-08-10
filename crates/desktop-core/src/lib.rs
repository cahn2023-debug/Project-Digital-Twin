pub mod auth;
pub mod crypto;
pub mod db_encrypted;
pub mod hash;
pub mod manifest;
pub mod mutation;
pub mod queue;
pub mod replay;
pub mod safe_write;
pub mod scanner;
pub mod server_sync;

pub use auth::{cache_session, hash_password, validate_offline_login, AuthResult};
pub use crypto::DbPasskey;
pub use db_encrypted::{CachedCredential, DbError, DbResult, EncryptedDb, MutationEvent};
pub use hash::{sha256_file, sha256_reader};
pub use manifest::{
    file_id_for_path, source_id_for_directory, DiscoveredFile, FileScanContext, FileVersion,
    LocalImport, ManifestDb, ManifestEntry, PendingJob, RawRecord, ScanFailure, SourceRegistration,
};
pub use mutation::{
    enqueue_mutation, enqueue_mutation_with_metadata, fetch_pending_mutations, is_network_online,
    mark_mutation_status, pending_mutations_count, set_network_online, SyncPayloadEnvelope,
};
pub use replay::{ReplayEngine, SyncBatchResult};
pub use safe_write::{safe_replace, SafeWriteError};
pub use scanner::{scan_directory, scan_directory_best_effort};
pub use server_sync::{ConflictChoice, ConflictItem, ServerSyncHandler};

#[cfg(test)]
mod tests {
    use super::{
        safe_replace, scan_directory, sha256_reader, source_id_for_directory, DiscoveredFile,
        ManifestDb, RawRecord, SafeWriteError,
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
    fn local_import_result_persists_change_set_payload_and_raw_records() {
        let directory = tempfile::tempdir().expect("tempdir");
        let database_path = directory.path().join("manifest.sqlite");
        let version_id;
        {
            let database = ManifestDb::open(&database_path).expect("manifest");
            database
                .upsert_file("file-1", "SOURCE", "C:/Data/Camera.xlsx", "now")
                .expect("file");
            version_id = database
                .register_file_version("version-1", "file-1", "hash-1", 10, None, "now")
                .expect("version")
                .expect("new version")
                .file_version_id;
            database
                .store_local_import_result(
                    "import-1",
                    "project-1",
                    &version_id,
                    "IMPORTED",
                    r#"{"changeset":{"id":"change-1"}}"#,
                    "now",
                    &[RawRecord {
                        raw_id: "raw-1".to_owned(),
                        file_version_id: version_id.clone(),
                        row_key: "row-2".to_owned(),
                        payload: r#"{"CameraCode":"CAM-001"}"#.to_owned(),
                        source_locator: r#"{"sheet":"CAMERA","row":2,"column":"A"}"#.to_owned(),
                    }],
                )
                .expect("local import");
        }
        let database = ManifestDb::open(&database_path).expect("reopen manifest");
        assert_eq!(
            database
                .local_import("import-1")
                .expect("import")
                .expect("saved")
                .2,
            "IMPORTED"
        );
        assert_eq!(
            database
                .raw_records_for_version(&version_id)
                .expect("raw records")
                .len(),
            1
        );
        assert!(database
            .save_local_profile("camera-custom", "project-1", 1, "{}", "now")
            .expect("profile"));
        assert!(!database
            .save_local_profile("camera-custom", "project-1", 1, "changed", "later")
            .expect("immutable profile"));
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
        let hidden = directory.path().join(".hidden");
        std::fs::create_dir_all(&nested).expect("nested");
        std::fs::create_dir_all(&hidden).expect("hidden");
        let path = nested.join("camera.xlsx");
        let temporary = nested.join("~$camera.xlsx");
        let hidden_file = hidden.join("hidden.xlsx");
        std::fs::write(&path, b"camera").expect("file");
        std::fs::write(&temporary, b"temporary").expect("temporary");
        std::fs::write(&hidden_file, b"hidden").expect("hidden file");

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
    fn pending_jobs_are_claimed_once_and_can_complete_or_retry() {
        let database = ManifestDb::open_in_memory().expect("manifest");
        database
            .enqueue_job("job-1", "FILE_SCAN", "payload", "key-1", "now")
            .expect("enqueue");

        let claimed = database.claim_next_job(0).expect("claim").expect("job");
        assert_eq!(claimed.job_id, "job-1");
        assert_eq!(claimed.status, "PROCESSING");
        assert!(database.claim_next_job(0).expect("second claim").is_none());
        assert!(database
            .retry_job("job-1", "temporary", 10, 3)
            .expect("retry"));
        assert!(database.claim_next_job(5).expect("before retry").is_none());
        assert_eq!(
            database
                .claim_next_job(10)
                .expect("reclaim")
                .expect("job")
                .job_id,
            "job-1"
        );
        assert!(database.complete_job("job-1").expect("complete"));
        assert!(!database.complete_job("job-1").expect("duplicate complete"));
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

    #[test]
    fn source_registrations_are_project_scoped_and_survive_restart() {
        let directory = tempfile::tempdir().expect("tempdir");
        let database_path = directory.path().join("manifest.sqlite");
        let source_id = {
            let database = ManifestDb::open(&database_path).expect("manifest");
            let source = database
                .register_source("project-1", "C:/Data/Source", 5, "now")
                .expect("source");
            let same_source = database
                .register_source("project-1", "C:/Data/Source", 8, "later")
                .expect("idempotent source");
            assert_eq!(source.source_id, same_source.source_id);
            assert_eq!(database.list_sources("project-1").expect("list").len(), 1);
            assert_eq!(
                database
                    .list_sources("project-2")
                    .expect("other list")
                    .len(),
                0
            );
            source.source_id
        };

        let reopened = ManifestDb::open(&database_path).expect("reopen");
        let source = reopened
            .source_registration(&source_id)
            .expect("lookup")
            .expect("registered source");
        assert_eq!(source.project_id, "project-1");
        assert_eq!(source.debounce_seconds, 8);
    }

    #[test]
    fn source_scan_payload_contains_source_identity_and_is_idempotent() {
        let database = ManifestDb::open_in_memory().expect("manifest");
        database
            .register_source("project-1", "C:/Data", 5, "now")
            .expect("register source");
        let source_id = source_id_for_directory("project-1", "C:/Data");
        let file = DiscoveredFile {
            path: "C:/Data/Camera.xlsx".to_owned(),
            sha256: "hash".to_owned(),
            size: 10,
            modified_at: Some("1".to_owned()),
        };
        assert!(database
            .enqueue_file_scan_for_source(&source_id, &file, "now")
            .expect("enqueue"));
        assert!(!database
            .enqueue_file_scan_for_source(&source_id, &file, "later")
            .expect("duplicate"));
        let job = database.claim_next_job(0).expect("claim").expect("job");
        assert!(job.payload.contains(&source_id));
        assert!(job.payload.contains("Camera.xlsx"));
    }
}
