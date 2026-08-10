use crate::db::EncryptedDbState;
use desktop_core::{
    enqueue_mutation, is_network_online, pending_mutations_count, set_network_online, MutationEvent,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MutationResponse {
    pub success: bool,
    pub message: String,
    pub event: Option<MutationEvent>,
    pub pending_count: i64,
    pub is_online: bool,
}

#[tauri::command]
pub fn push_client_mutation(
    state: tauri::State<'_, EncryptedDbState>,
    entity_type: String,
    entity_id: String,
    action: String,
    payload: String,
) -> Result<MutationResponse, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(ref db) = *guard {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let event = enqueue_mutation(db, &entity_type, &entity_id, &action, &payload, now)
            .map_err(|e| format!("Failed to enqueue mutation event: {:?}", e))?;

        let count = pending_mutations_count(db).unwrap_or(0);
        let online = is_network_online();

        Ok(MutationResponse {
            success: true,
            message: "Mutation event queued".to_string(),
            event: Some(event),
            pending_count: count,
            is_online: online,
        })
    } else {
        Err("Encrypted database not initialized".to_string())
    }
}

#[tauri::command]
pub fn get_pending_mutation_count(
    state: tauri::State<'_, EncryptedDbState>,
) -> Result<i64, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(ref db) = *guard {
        pending_mutations_count(db).map_err(|e| format!("Database error: {:?}", e))
    } else {
        Ok(0)
    }
}

#[tauri::command]
pub fn set_network_status(online: bool) -> bool {
    set_network_online(online);
    is_network_online()
}
