use crate::db::EncryptedDbState;
use desktop_core::{cache_session, validate_offline_login, AuthResult, CachedCredential};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
    pub credential: Option<CachedCredential>,
}

#[tauri::command]
pub fn cache_user_session(
    state: tauri::State<'_, EncryptedDbState>,
    user_id: String,
    username: String,
    password: String,
    jwt_token: String,
    expires_at: String,
) -> Result<AuthResponse, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(ref db) = *guard {
        let now_iso = "2026-08-10T08:00:00Z";
        cache_session(
            db,
            &user_id,
            &username,
            &password,
            &jwt_token,
            &expires_at,
            now_iso,
        )
        .map_err(|e| format!("Failed to cache session: {:?}", e))?;

        Ok(AuthResponse {
            success: true,
            message: "User session cached successfully".to_string(),
            credential: None,
        })
    } else {
        Err("Encrypted database not initialized".to_string())
    }
}

#[tauri::command]
pub fn offline_authenticate_user(
    state: tauri::State<'_, EncryptedDbState>,
    user_id: String,
    password: String,
) -> Result<AuthResponse, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(ref db) = *guard {
        let now_iso = "2026-08-10T08:30:00Z";
        match validate_offline_login(db, &user_id, &password, now_iso) {
            Ok(AuthResult::Success(cred)) => Ok(AuthResponse {
                success: true,
                message: "Offline authentication successful".to_string(),
                credential: Some(cred),
            }),
            Ok(AuthResult::InvalidCredentials) => Ok(AuthResponse {
                success: false,
                message: "Invalid password".to_string(),
                credential: None,
            }),
            Ok(AuthResult::TokenExpired) => Ok(AuthResponse {
                success: false,
                message: "Cached session token expired".to_string(),
                credential: None,
            }),
            Ok(AuthResult::NoCachedSession) => Ok(AuthResponse {
                success: false,
                message: "No cached session found for user".to_string(),
                credential: None,
            }),
            Err(err) => Err(format!("Database error during authentication: {:?}", err)),
        }
    } else {
        Err("Encrypted database not initialized".to_string())
    }
}
