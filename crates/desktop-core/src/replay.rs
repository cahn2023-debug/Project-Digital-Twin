use crate::db_encrypted::{DbResult, EncryptedDb, MutationEvent};
use crate::mutation::is_network_online;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SyncBatchResult {
    pub total_processed: usize,
    pub synced_count: usize,
    pub conflict_count: usize,
    pub failed_count: usize,
    pub message: String,
}

pub struct ReplayEngine;

impl ReplayEngine {
    /// Replays pending mutation events to server handler or mock server sink
    pub fn replay_pending<F>(
        db: &EncryptedDb,
        batch_size: usize,
        server_handler: F,
    ) -> DbResult<SyncBatchResult>
    where
        F: Fn(&MutationEvent) -> Result<(), String>,
    {
        if !is_network_online() {
            return Ok(SyncBatchResult {
                total_processed: 0,
                synced_count: 0,
                conflict_count: 0,
                failed_count: 0,
                message: "Device is currently offline".to_string(),
            });
        }

        let pending_events = db.get_pending_mutation_events(batch_size)?;
        let mut synced_count = 0;
        let mut conflict_count = 0;
        let mut failed_count = 0;

        for event in &pending_events {
            match server_handler(event) {
                Ok(()) => {
                    db.update_mutation_status(&event.id, "SYNCED")?;
                    synced_count += 1;
                }
                Err(err) if err.contains("CONFLICT") => {
                    db.update_mutation_status(&event.id, "STAGED_FOR_REVIEW")?;
                    conflict_count += 1;
                }
                Err(_) => {
                    let new_retry = event.retry_count + 1;
                    if new_retry >= 5 {
                        db.update_mutation_status(&event.id, "FAILED")?;
                    } else {
                        db.update_mutation_status(&event.id, "PENDING")?;
                    }
                    failed_count += 1;
                }
            }
        }

        Ok(SyncBatchResult {
            total_processed: pending_events.len(),
            synced_count,
            conflict_count,
            failed_count,
            message: format!(
                "Replayed {} events: {} synced, {} staged conflicts, {} failed",
                pending_events.len(),
                synced_count,
                conflict_count,
                failed_count
            ),
        })
    }

    /// Triggers immediate manual sync regardless of background worker schedule
    pub fn trigger_manual_sync<F>(
        db: &EncryptedDb,
        batch_size: usize,
        server_handler: F,
    ) -> DbResult<SyncBatchResult>
    where
        F: Fn(&MutationEvent) -> Result<(), String>,
    {
        Self::replay_pending(db, batch_size, server_handler)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::DbPasskey;
    use crate::mutation::{enqueue_mutation, set_network_online};

    #[test]
    fn replays_events_and_updates_status() {
        let passkey = DbPasskey::new("secret");
        let db = EncryptedDb::open_in_memory(&passkey).expect("db");

        enqueue_mutation(&db, "PROJECT", "p-1", "CREATE", "{}", 1000).expect("e1");
        enqueue_mutation(&db, "PROJECT", "p-2", "CREATE", "{}", 1001).expect("e2");

        // When offline, replay does nothing
        set_network_online(false);
        let off_res = ReplayEngine::replay_pending(&db, 10, |_| Ok(())).expect("replay");
        assert_eq!(off_res.total_processed, 0);

        // When online, replay syncs events
        set_network_online(true);
        let on_res = ReplayEngine::replay_pending(&db, 10, |evt| {
            if evt.entity_id == "p-2" {
                Err("CONFLICT: Server has newer version".to_string())
            } else {
                Ok(())
            }
        })
        .expect("replay");

        assert_eq!(on_res.total_processed, 2);
        assert_eq!(on_res.synced_count, 1);
        assert_eq!(on_res.conflict_count, 1);
        assert_eq!(db.pending_event_count().expect("count"), 0);
    }
}
