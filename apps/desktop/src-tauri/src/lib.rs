mod auth_cmd;
mod conflict_cmd;
mod db;
mod jobs;
mod main_core;
mod mutation_cmd;
mod replay_cmd;
mod scan;
mod state;

pub use auth_cmd::{cache_user_session, offline_authenticate_user};
pub use conflict_cmd::resolve_mutation_conflict;
pub use db::{check_encrypted_database_health, init_encrypted_database, EncryptedDbState};
pub use jobs::{claim_pending_jobs, complete_pending_job, retry_pending_job};
pub use main_core::WatcherState;
pub use mutation_cmd::{get_pending_mutation_count, push_client_mutation, set_network_status};
pub use replay_cmd::trigger_manual_sync;
pub use scan::{
    get_local_manifest_path, health, list_local_sources, register_local_source,
    scan_local_directory, scan_source_directory, start_local_watcher, start_source_watcher,
    stop_local_watcher, stop_source_watcher,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    main_core::run(tauri::generate_handler![
        health,
        get_local_manifest_path,
        scan_local_directory,
        register_local_source,
        list_local_sources,
        scan_source_directory,
        start_local_watcher,
        start_source_watcher,
        stop_local_watcher,
        stop_source_watcher,
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
    ]);
}
