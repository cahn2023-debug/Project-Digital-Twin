use desktop_core::{DbPasskey, EncryptedDb};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{atomic::AtomicBool, Arc, Mutex};

pub struct EncryptedDbState {
    pub db: Arc<Mutex<Option<EncryptedDb>>>,
    pub sync_worker_started: AtomicBool,
}

impl Default for EncryptedDbState {
    fn default() -> Self {
        Self {
            db: Arc::new(Mutex::new(None)),
            sync_worker_started: AtomicBool::new(false),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbStatusResponse {
    pub is_initialized: bool,
    pub is_healthy: bool,
    pub message: String,
}

#[tauri::command]
pub fn init_encrypted_database(
    state: tauri::State<'_, EncryptedDbState>,
    db_path: String,
    secret_passkey: String,
) -> Result<DbStatusResponse, String> {
    let passkey = DbPasskey::new(&secret_passkey);
    let path = PathBuf::from(&db_path);

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    match EncryptedDb::open(&path, &passkey) {
        Ok(db) => {
            let is_healthy = db.is_encrypted_and_healthy();
            let mut guard = state.db.lock().map_err(|e| e.to_string())?;
            *guard = Some(db);
            drop(guard);
            crate::replay_cmd::start_background_replay(&state);

            Ok(DbStatusResponse {
                is_initialized: true,
                is_healthy,
                message: "SQLCipher database initialized successfully".to_string(),
            })
        }
        Err(err) => Err(format!(
            "Failed to initialize encrypted database: {:?}",
            err
        )),
    }
}

#[tauri::command]
pub fn check_encrypted_database_health(
    state: tauri::State<'_, EncryptedDbState>,
) -> DbStatusResponse {
    if let Ok(guard) = state.db.lock() {
        if let Some(ref db) = *guard {
            let is_healthy = db.is_encrypted_and_healthy();
            return DbStatusResponse {
                is_initialized: true,
                is_healthy,
                message: if is_healthy {
                    "Database is healthy and encrypted".to_string()
                } else {
                    "Database health check failed".to_string()
                },
            };
        }
    }

    DbStatusResponse {
        is_initialized: false,
        is_healthy: false,
        message: "Database not initialized".to_string(),
    }
}
