use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use std::time::Duration;

use desktop_core::{scan_directory_best_effort, ManifestDb};
use tauri::State;

use super::WatcherState;

#[tauri::command]
pub fn health() -> &'static str {
    "ok"
}

fn scan_and_enqueue(
    manifest_path: &str,
    directory: &str,
    debounce_seconds: i64,
    observed_at: i64,
) -> Result<usize, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    let (files, failures) = scan_directory_best_effort(
        Path::new(directory),
        &["xlsx", "xlsm", "xls", "md", "txt", "doc", "docx"],
    )
    .map_err(|error| error.to_string())?;
    let mut queued = 0;
    for failure in failures {
        if database
            .enqueue_file_failure(&failure.path, &failure.error, &observed_at.to_string())
            .map_err(|error| error.to_string())?
        {
            queued += 1;
        }
    }
    for file in files {
        if database
            .observe_file(
                &file.path,
                file.size,
                file.modified_at.as_deref(),
                &file.sha256,
                observed_at,
                debounce_seconds,
            )
            .map_err(|error| error.to_string())?
            && database
                .enqueue_file_scan(&file, &observed_at.to_string())
                .map_err(|error| error.to_string())?
        {
            queued += 1;
        }
    }
    Ok(queued)
}

#[tauri::command]
pub fn scan_local_directory(
    manifest_path: String,
    directory: String,
    debounce_seconds: i64,
    observed_at: i64,
) -> Result<usize, String> {
    scan_and_enqueue(&manifest_path, &directory, debounce_seconds, observed_at)
}

#[tauri::command]
pub fn start_local_watcher(
    manifest_path: String,
    directory: String,
    debounce_seconds: i64,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut current = state.stop.lock().map_err(|_| "watcher state poisoned")?;
        if current.is_some() {
            return Ok(());
        }
        *current = Some(stop.clone());
    }
    thread::spawn(move || {
        let interval = Duration::from_millis((debounce_seconds.max(1) as u64 * 500).max(250));
        let mut observed_at = 0_i64;
        while !stop.load(Ordering::Relaxed) {
            let _ = scan_and_enqueue(
                &manifest_path,
                &directory,
                debounce_seconds.max(1),
                observed_at,
            );
            observed_at += interval.as_secs().max(1) as i64;
            thread::sleep(interval);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn stop_local_watcher(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut current = state.stop.lock().map_err(|_| "watcher state poisoned")?;
    if let Some(stop) = current.take() {
        stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}
