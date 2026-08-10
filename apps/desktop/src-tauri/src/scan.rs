use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use std::time::Duration;

use desktop_core::{scan_directory_best_effort, ManifestDb, SourceRegistration};
use tauri::{Manager, State};

use super::WatcherState;

const SUPPORTED_EXTENSIONS: [&str; 7] = ["xlsx", "xlsm", "xls", "md", "txt", "doc", "docx"];

#[tauri::command]
pub fn health() -> &'static str {
    "ok"
}

#[tauri::command]
pub fn get_local_manifest_path(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<String, String> {
    let project_segment: String = project_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect();
    if project_segment.is_empty() {
        return Err("project id is required".to_owned());
    }
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("projects");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory
        .join(format!("{project_segment}.manifest.sqlite"))
        .to_string_lossy()
        .into_owned())
}

fn scan_and_enqueue(
    manifest_path: &str,
    directory: &str,
    debounce_seconds: i64,
    observed_at: i64,
    source_id: Option<&str>,
) -> Result<usize, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    let (files, failures) = scan_directory_best_effort(Path::new(directory), &SUPPORTED_EXTENSIONS)
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
            && match source_id {
                Some(source_id) => database
                    .enqueue_file_scan_for_source(source_id, &file, &observed_at.to_string())
                    .map_err(|error| error.to_string())?,
                None => database
                    .enqueue_file_scan(&file, &observed_at.to_string())
                    .map_err(|error| error.to_string())?,
            }
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
    scan_and_enqueue(
        &manifest_path,
        &directory,
        debounce_seconds,
        observed_at,
        None,
    )
}

#[tauri::command]
pub fn register_local_source(
    manifest_path: String,
    project_id: String,
    directory: String,
    debounce_seconds: i64,
    registered_at: String,
) -> Result<SourceRegistration, String> {
    let path = std::fs::canonicalize(&directory).map_err(|error| error.to_string())?;
    if !path.is_dir() {
        return Err("source path is not a directory".to_owned());
    }
    let normalized = path.to_string_lossy().into_owned();
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .register_source(&project_id, &normalized, debounce_seconds, &registered_at)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_local_sources(
    manifest_path: String,
    project_id: String,
) -> Result<Vec<SourceRegistration>, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    database
        .list_sources(&project_id)
        .map_err(|error| error.to_string())
}

fn scan_registered_source(
    manifest_path: &str,
    source_id: &str,
    debounce_seconds: i64,
    observed_at: i64,
) -> Result<usize, String> {
    let database = ManifestDb::open(manifest_path).map_err(|error| error.to_string())?;
    let source = database
        .source_registration(source_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "source registration not found".to_owned())?;
    let result = scan_and_enqueue(
        manifest_path,
        &source.directory,
        debounce_seconds,
        observed_at,
        Some(&source.source_id),
    );
    let error = result.as_ref().err().map(String::as_str);
    database
        .record_source_scan(source_id, &observed_at.to_string(), error)
        .map_err(|error| error.to_string())?;
    result
}

#[tauri::command]
pub fn scan_source_directory(
    manifest_path: String,
    source_id: String,
    debounce_seconds: i64,
    observed_at: i64,
) -> Result<usize, String> {
    scan_registered_source(&manifest_path, &source_id, debounce_seconds, observed_at)
}

fn start_watcher(
    manifest_path: String,
    key: String,
    directory: String,
    debounce_seconds: i64,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut current = state.stops.lock().map_err(|_| "watcher state poisoned")?;
        if let Some(existing) = current.get(&key) {
            if !existing.load(Ordering::Relaxed) {
                return Ok(());
            }
        }
        current.insert(key, stop.clone());
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
                None,
            );
            observed_at += interval.as_secs().max(1) as i64;
            thread::sleep(interval);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn start_local_watcher(
    manifest_path: String,
    directory: String,
    debounce_seconds: i64,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    start_watcher(
        manifest_path,
        directory.clone(),
        directory,
        debounce_seconds,
        state,
    )
}

#[tauri::command]
pub fn start_source_watcher(
    manifest_path: String,
    source_id: String,
    debounce_seconds: i64,
    updated_at: String,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let database = ManifestDb::open(&manifest_path).map_err(|error| error.to_string())?;
    if !database
        .set_source_watcher_enabled(&source_id, true, &updated_at)
        .map_err(|error| error.to_string())?
    {
        return Err("source registration not found".to_owned());
    }
    let key = source_id.clone();
    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut current = state.stops.lock().map_err(|_| "watcher state poisoned")?;
        if let Some(existing) = current.get(&key) {
            if !existing.load(Ordering::Relaxed) {
                return Ok(());
            }
        }
        current.insert(key, stop.clone());
    }
    thread::spawn(move || {
        let interval = Duration::from_millis((debounce_seconds.max(1) as u64 * 500).max(250));
        let mut observed_at = 0_i64;
        while !stop.load(Ordering::Relaxed) {
            let _ = scan_registered_source(
                &manifest_path,
                &source_id,
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
pub fn stop_source_watcher(
    manifest_path: String,
    source_id: String,
    updated_at: String,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let database = ManifestDb::open(&manifest_path).map_err(|error| error.to_string())?;
    if !database
        .set_source_watcher_enabled(&source_id, false, &updated_at)
        .map_err(|error| error.to_string())?
    {
        return Err("source registration not found".to_owned());
    }
    let mut current = state.stops.lock().map_err(|_| "watcher state poisoned")?;
    if let Some(stop) = current.remove(&source_id) {
        stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub fn stop_local_watcher(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut current = state.stops.lock().map_err(|_| "watcher state poisoned")?;
    for stop in current.values() {
        stop.store(true, Ordering::Relaxed);
    }
    current.clear();
    Ok(())
}
