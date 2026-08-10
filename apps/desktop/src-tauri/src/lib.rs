mod jobs;
mod scan;
mod state;

pub use jobs::{claim_pending_jobs, complete_pending_job, retry_pending_job};
pub use scan::{health, scan_local_directory, start_local_watcher, stop_local_watcher};
pub use state::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            health,
            scan_local_directory,
            start_local_watcher,
            stop_local_watcher,
            claim_pending_jobs,
            complete_pending_job,
            retry_pending_job
        ])
        .run(tauri::generate_context!())
        .expect("error while running Project Digital Twin desktop");
}
