use crate::db::EncryptedDbState;
use desktop_core::{ConflictChoice, ServerSyncHandler};

#[tauri::command]
pub fn resolve_mutation_conflict(
    state: tauri::State<'_, EncryptedDbState>,
    event_id: String,
    choice: String,
) -> Result<bool, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(ref db) = *guard {
        let resolution = match choice.as_str() {
            "USE_SERVER" => ConflictChoice::UseServer,
            "OVERWRITE_WITH_CLIENT" => ConflictChoice::OverwriteWithClient,
            _ => return Err("Invalid resolution choice".to_string()),
        };

        ServerSyncHandler::resolve_conflict(db, &event_id, resolution)
            .map_err(|e| format!("Conflict resolution error: {:?}", e))?;
        Ok(true)
    } else {
        Err("Encrypted database not initialized".to_string())
    }
}
