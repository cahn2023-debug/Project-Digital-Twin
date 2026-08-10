use desktop_core::{ManifestDb, PendingJob};

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
