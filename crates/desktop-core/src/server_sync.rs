use crate::db_encrypted::{DbResult, EncryptedDb, MutationEvent};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConflictChoice {
    UseServer,
    OverwriteWithClient,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConflictItem {
    pub event_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub local_payload: String,
    pub server_payload: String,
    pub timestamp: i64,
}

pub struct ServerSyncHandler;

impl ServerSyncHandler {
    /// Simulates server-side replay validation with version conflict detection
    pub fn process_event_with_server_check<F>(
        event: &MutationEvent,
        get_server_state: F,
    ) -> Result<(), String>
    where
        F: Fn(&str, &str) -> Option<(i64, String)>,
    {
        if let Some((server_version_time, server_data)) =
            get_server_state(&event.entity_type, &event.entity_id)
        {
            // If server state was modified after the mutation timestamp, flag CONFLICT
            if server_version_time > event.timestamp {
                return Err(format!(
                    "CONFLICT: Server has newer modification (server: {}, client: {}, payload: {})",
                    server_version_time, event.timestamp, server_data
                ));
            }
        }
        Ok(())
    }

    /// Resolves a conflict according to user choice
    pub fn resolve_conflict(
        db: &EncryptedDb,
        event_id: &str,
        choice: ConflictChoice,
    ) -> DbResult<()> {
        match choice {
            ConflictChoice::UseServer => {
                // Discard local pending mutation event by marking as DISCARDED or deleting
                db.update_mutation_status(event_id, "DISCARDED_RESOLVED")
            }
            ConflictChoice::OverwriteWithClient => {
                // Re-queue event for immediate forced sync by resetting status to PENDING
                db.update_mutation_status(event_id, "PENDING")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::DbPasskey;
    use crate::mutation::enqueue_mutation;

    #[test]
    fn detects_server_conflict_and_resolves() {
        let passkey = DbPasskey::new("secret");
        let db = EncryptedDb::open_in_memory(&passkey).expect("db");

        let event = enqueue_mutation(&db, "PROJECT", "p-10", "UPDATE", r#"{"name":"Client"}"#, 1000)
            .expect("enqueue");

        // Server has newer timestamp 2000 > 1000
        let result = ServerSyncHandler::process_event_with_server_check(&event, |_, _| {
            Some((2000, r#"{"name":"Server"}"#.to_string()))
        });

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("CONFLICT"));

        db.update_mutation_status(&event.id, "CONFLICT")
            .expect("set conflict");

        // Resolve choosing UseServer
        ServerSyncHandler::resolve_conflict(&db, &event.id, ConflictChoice::UseServer)
            .expect("resolve");

        let pending = db.get_pending_mutation_events(10).expect("pending");
        assert_eq!(pending.len(), 0);

        // Resolve choosing OverwriteWithClient
        ServerSyncHandler::resolve_conflict(&db, &event.id, ConflictChoice::OverwriteWithClient)
            .expect("resolve overwrite");

        let pending_requeued = db.get_pending_mutation_events(10).expect("pending");
        assert_eq!(pending_requeued.len(), 1);
        assert_eq!(pending_requeued[0].status, "PENDING");
    }
}
