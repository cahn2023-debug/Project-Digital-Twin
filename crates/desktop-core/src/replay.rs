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
    /// Replays pending mutation events through a per-event compatibility handler.
    pub fn replay_pending<F>(
        db: &EncryptedDb,
        batch_size: usize,
        server_handler: F,
    ) -> DbResult<SyncBatchResult>
    where
        F: Fn(&MutationEvent) -> Result<(), String>,
    {
        Self::replay_pending_batch(db, batch_size, |events| {
            Ok(events.iter().map(|event| server_handler(event)).collect())
        })
    }

    /// Replays one bounded batch and applies each server result durably.
    pub fn replay_pending_batch<F>(
        db: &EncryptedDb,
        batch_size: usize,
        server_handler: F,
    ) -> DbResult<SyncBatchResult>
    where
        F: Fn(&[MutationEvent]) -> Result<Vec<Result<(), String>>, String>,
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

        let outcomes = match server_handler(&pending_events) {
            Ok(outcomes) if outcomes.len() == pending_events.len() => outcomes,
            Ok(_) => vec![
                Err("Sync response did not cover the submitted batch".to_owned());
                pending_events.len()
            ],
            Err(error) => (0..pending_events.len())
                .map(|_| Err(error.clone()))
                .collect(),
        };

        for (event, outcome) in pending_events.iter().zip(outcomes) {
            match outcome {
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
                        db.update_mutation_status_with_retry(&event.id, "FAILED", new_retry)?;
                    } else {
                        db.update_mutation_status_with_retry(&event.id, "PENDING", new_retry)?;
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

    #[test]
    fn persists_retry_count_for_transient_batch_failures() {
        let passkey = DbPasskey::new("secret-retry");
        let db = EncryptedDb::open_in_memory(&passkey).expect("db");
        enqueue_mutation(&db, "PROJECT", "p-retry", "UPDATE", "{}", 3000).expect("enqueue");

        set_network_online(true);
        let result = ReplayEngine::replay_pending_batch(&db, 10, |events| {
            assert_eq!(events.len(), 1);
            Ok(vec![Err("temporary network error".to_owned())])
        })
        .expect("replay");

        assert_eq!(result.failed_count, 1);
        let pending = db.get_pending_mutation_events(10).expect("pending");
        assert_eq!(pending[0].retry_count, 1);
    }
}
