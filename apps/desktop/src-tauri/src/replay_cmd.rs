use crate::db::EncryptedDbState;
use desktop_core::{MutationEvent, ReplayEngine, SyncBatchResult, SyncPayloadEnvelope};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{atomic::Ordering, Arc};
use std::thread;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct SyncMutationAck {
    mutation_id: String,
    status: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct SyncBatchResponse {
    results: Vec<SyncMutationAck>,
}

fn send_events(
    client: &Client,
    endpoint: &str,
    events: &[MutationEvent],
) -> Result<Vec<Result<(), String>>, String> {
    let envelopes: Vec<SyncPayloadEnvelope> = events
        .iter()
        .map(|event| {
            serde_json::from_str(&event.payload)
                .map_err(|error| format!("Invalid sync payload: {error}"))
        })
        .collect::<Result<_, _>>()?;
    let response = client
        .post(endpoint)
        .json(&serde_json::json!({ "mutations": envelopes }))
        .send()
        .map_err(|error| format!("Sync request failed: {error}"))?;
    let status_code = response.status();
    if !status_code.is_success() {
        return Err(format!("Sync endpoint returned {status_code}"));
    }
    let batch: SyncBatchResponse = response
        .json()
        .map_err(|error| format!("Invalid sync response: {error}"))?;
    let results: HashMap<String, SyncMutationAck> = batch
        .results
        .into_iter()
        .map(|result| (result.mutation_id.clone(), result))
        .collect();
    Ok(events
        .iter()
        .map(|event| match results.get(&event.id) {
            None => Err("Sync endpoint returned no mutation result".to_owned()),
            Some(result) => match result.status.as_str() {
                "SYNCED" | "IGNORED_DUPLICATE" => Ok(()),
                "STAGED_FOR_REVIEW" => Err(format!("CONFLICT: {}", result.message)),
                _ => Err(result.message.clone()),
            },
        })
        .collect())
}

pub(crate) fn start_background_replay(state: &EncryptedDbState) {
    if state
        .sync_worker_started
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }

    let db = Arc::clone(&state.db);
    let base_url = std::env::var("PROJECT_SYNC_SERVER_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8000".to_owned());
    let endpoint = format!(
        "{}/api/v1/sync/reconcile-batch",
        base_url.trim_end_matches('/')
    );

    thread::spawn(move || {
        let client = Client::new();
        loop {
            if desktop_core::is_network_online() {
                if let Ok(guard) = db.lock() {
                    if let Some(database) = guard.as_ref() {
                        let result = ReplayEngine::replay_pending_batch(database, 20, |events| {
                            send_events(&client, &endpoint, events)
                        });
                        if let Err(error) = result {
                            eprintln!("Background sync failed: {error:?}");
                        }
                    }
                }
            }
            thread::sleep(Duration::from_secs(5));
        }
    });
}

#[tauri::command]
pub fn trigger_manual_sync(
    state: tauri::State<'_, EncryptedDbState>,
    batch_size: Option<usize>,
    server_url: Option<String>,
) -> Result<SyncBatchResult, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(ref db) = *guard {
        let size = batch_size.unwrap_or(20);
        let base_url = server_url
            .or_else(|| std::env::var("PROJECT_SYNC_SERVER_URL").ok())
            .unwrap_or_else(|| "http://127.0.0.1:8000".to_owned());
        let endpoint = format!(
            "{}/api/v1/sync/reconcile-batch",
            base_url.trim_end_matches('/')
        );
        let client = Client::new();
        ReplayEngine::replay_pending_batch(db, size, |events| {
            send_events(&client, &endpoint, events)
        })
        .map_err(|e| format!("Replay error: {:?}", e))
    } else {
        Err("Encrypted database not initialized".to_string())
    }
}
