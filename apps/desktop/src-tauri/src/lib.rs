mod auth_cmd;
mod conflict_cmd;
mod db;
mod jobs;
mod mutation_cmd;
mod replay_cmd;
mod scan;
mod state;

pub use auth_cmd::{cache_user_session, offline_authenticate_user};
pub use conflict_cmd::resolve_mutation_conflict;
pub use db::{check_encrypted_database_health, init_encrypted_database, EncryptedDbState};
pub use jobs::{claim_pending_jobs, complete_pending_job, retry_pending_job};
pub use mutation_cmd::{get_pending_mutation_count, push_client_mutation, set_network_status};
pub use replay_cmd::trigger_manual_sync;
pub use scan::{health, scan_local_directory, start_local_watcher, stop_local_watcher};
pub use state::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::default())
        .manage(EncryptedDbState::default())
        .invoke_handler(tauri::generate_handler![
            health,
            scan_local_directory,
            start_local_watcher,
            stop_local_watcher,
            claim_pending_jobs,
            complete_pending_job,
            retry_pending_job,
            init_encrypted_database,
            check_encrypted_database_health,
            cache_user_session,
            offline_authenticate_user,
            push_client_mutation,
            get_pending_mutation_count,
            set_network_status,
            trigger_manual_sync,
            resolve_mutation_conflict
        ])
        .run(tauri::generate_context!())
        .expect("error while running Project Digital Twin desktop");
}
