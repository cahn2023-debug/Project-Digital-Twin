use crate::db::EncryptedDbState;
use desktop_core::{ReplayEngine, SyncBatchResult};

#[tauri::command]
pub fn trigger_manual_sync(
    state: tauri::State<'_, EncryptedDbState>,
    batch_size: Option<usize>,
) -> Result<SyncBatchResult, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(ref db) = *guard {
        let size = batch_size.unwrap_or(20);
        ReplayEngine::replay_pending(db, size, |_event| Ok(()))
            .map_err(|e| format!("Replay error: {:?}", e))
    } else {
        Err("Encrypted database not initialized".to_string())
    }
}
