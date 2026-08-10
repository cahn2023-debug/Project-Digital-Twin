use desktop_core::{
    DiscoveredFile, FileScanContext, LocalAsset, LocalAuditEvent, LocalImport, LocalImportHistory,
    LocalProfile, ManifestDb, PendingJob, RawRecord,
};

#[tauri::command]
pub fn claim_pending_jobs(
    manifest_path: String,
    now: i64,
    max_jobs: usize,
) -> Result<Vec<PendingJob>, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    let mut jobs = Vec::new();
    for _ in 0..max_jobs {
        let Some(job) = database
            .claim_next_job(now)
            .map_err(|error| error.to_string())?
        else {
            break;
        };
        jobs.push(job);
    }
    Ok(jobs)
}

#[tauri::command]
pub fn list_pending_jobs(
    manifest_path: String,
    source_id: Option<String>,
) -> Result<Vec<PendingJob>, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .list_pending_jobs(source_id.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_pending_job_progress(
    manifest_path: String,
    job_id: String,
    progress: i64,
    phase: String,
) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .update_job_progress(&job_id, progress, &phase)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn cancel_pending_job(manifest_path: String, job_id: String) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .request_job_cancellation(&job_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn is_pending_job_cancelled(manifest_path: String, job_id: String) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .is_job_cancel_requested(&job_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn prepare_file_scan(
    manifest_path: String,
    path: String,
    sha256: String,
    size: u64,
    modified_at: Option<String>,
    created_at: String,
) -> Result<FileScanContext, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .register_scanned_file(
            &DiscoveredFile {
                path,
                sha256,
                size,
                modified_at,
            },
            &created_at,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn store_local_import_result(
    manifest_path: String,
    import_id: String,
    project_id: String,
    file_version_id: String,
    status: String,
    payload: String,
    created_at: String,
    attempt: Option<i64>,
    raw_records: Vec<RawRecord>,
    assets: Option<Vec<LocalAsset>>,
    audit_events: Option<Vec<LocalAuditEvent>>,
) -> Result<(), String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .store_local_import_result_with_metadata(
            &import_id,
            &project_id,
            &file_version_id,
            &status,
            &payload,
            &created_at,
            attempt.unwrap_or_default(),
            &raw_records,
            assets.as_deref().unwrap_or_default(),
            audit_events.as_deref().unwrap_or_default(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_local_imports(
    manifest_path: String,
    project_id: String,
) -> Result<Vec<LocalImport>, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .list_local_imports(&project_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_local_profiles(
    manifest_path: String,
    project_id: String,
) -> Result<Vec<LocalProfile>, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .list_local_profiles(&project_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_local_import_history(
    manifest_path: String,
    project_id: String,
    import_id: Option<String>,
) -> Result<Vec<LocalImportHistory>, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .list_local_import_history(&project_id, import_id.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn mark_local_asset_sync(
    manifest_path: String,
    asset_id: String,
    asset_version: i64,
    status: String,
) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .mark_local_asset_sync(&asset_id, asset_version, &status)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn retry_file_scan(
    manifest_path: String,
    source_id: String,
    path: String,
    sha256: String,
    size: u64,
    modified_at: Option<String>,
    created_at: String,
) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .requeue_file_scan_for_source(
            &source_id,
            &DiscoveredFile {
                path,
                sha256,
                size,
                modified_at,
            },
            &created_at,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_local_profile(
    manifest_path: String,
    profile_id: String,
    project_id: String,
    version: i64,
    payload: String,
    created_at: String,
) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .save_local_profile(&profile_id, &project_id, version, &payload, &created_at)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn complete_pending_job(manifest_path: String, job_id: String) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .complete_job(&job_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn retry_pending_job(
    manifest_path: String,
    job_id: String,
    error: String,
    next_retry_at: i64,
    max_attempts: i64,
) -> Result<bool, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .retry_job(&job_id, &error, next_retry_at, max_attempts)
        .map_err(|error| error.to_string())
}
