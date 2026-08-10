use crate::db_encrypted::{DbResult, EncryptedDb, MutationEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use uuid::Uuid;

pub static IS_ONLINE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncPayloadEnvelope {
    pub mutation_id: String,
    pub client_id: String,
    pub workspace_id: String,
    pub user_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub timestamp: i64,
    pub payload: String,
    pub field_changes: HashMap<String, serde_json::Value>,
}

pub fn set_network_online(online: bool) {
    IS_ONLINE.store(online, Ordering::SeqCst);
}

pub fn is_network_online() -> bool {
    IS_ONLINE.load(Ordering::SeqCst)
}

pub fn enqueue_mutation_with_metadata(
    db: &EncryptedDb,
    workspace_id: &str,
    user_id: &str,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    payload_json: &str,
    now_timestamp: i64,
) -> DbResult<MutationEvent> {
    let client_id = db.get_or_create_client_id()?;
    let mutation_id = Uuid::new_v4().to_string();

    let parsed_fields: HashMap<String, serde_json::Value> =
        serde_json::from_str(payload_json).unwrap_or_default();

    let envelope = SyncPayloadEnvelope {
        mutation_id: mutation_id.clone(),
        client_id,
        workspace_id: workspace_id.to_string(),
        user_id: user_id.to_string(),
        entity_type: entity_type.to_string(),
        entity_id: entity_id.to_string(),
        action: action.to_string(),
        timestamp: now_timestamp,
        payload: payload_json.to_string(),
        field_changes: parsed_fields,
    };

    let envelope_json =
        serde_json::to_string(&envelope).unwrap_or_else(|_| payload_json.to_string());

    let event = MutationEvent {
        id: mutation_id,
        entity_type: entity_type.to_string(),
        entity_id: entity_id.to_string(),
        action: action.to_string(),
        payload: envelope_json,
        timestamp: now_timestamp,
        status: "PENDING".to_string(),
        retry_count: 0,
    };

    db.push_mutation_event(&event)?;
    Ok(event)
}

pub fn enqueue_mutation(
    db: &EncryptedDb,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    payload: &str,
    now_timestamp: i64,
) -> DbResult<MutationEvent> {
    enqueue_mutation_with_metadata(
        db,
        "default-workspace",
        "default-user",
        entity_type,
        entity_id,
        action,
        payload,
        now_timestamp,
    )
}

pub fn fetch_pending_mutations(db: &EncryptedDb, limit: usize) -> DbResult<Vec<MutationEvent>> {
    db.get_pending_mutation_events(limit)
}

pub fn mark_mutation_status(db: &EncryptedDb, event_id: &str, status: &str) -> DbResult<()> {
    db.update_mutation_status(event_id, status)
}

pub fn pending_mutations_count(db: &EncryptedDb) -> DbResult<i64> {
    db.pending_event_count()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::DbPasskey;

    #[test]
    fn enqueues_and_fetches_pending_mutations() {
        let passkey = DbPasskey::new("secret");
        let db = EncryptedDb::open_in_memory(&passkey).expect("db");

        set_network_online(false);
        assert!(!is_network_online());

        let e1 = enqueue_mutation(&db, "PROJECT", "p-1", "CREATE", r#"{"name":"P1"}"#, 1000)
            .expect("enqueue 1");
        let e2 = enqueue_mutation(
            &db,
            "PROJECT",
            "p-1",
            "UPDATE",
            r#"{"name":"P1-edited"}"#,
            1001,
        )
        .expect("enqueue 2");

        assert_eq!(pending_mutations_count(&db).expect("count"), 2);

        let pending = fetch_pending_mutations(&db, 10).expect("pending");
        assert_eq!(pending.len(), 2);
        assert_eq!(pending[0].id, e1.id);
        assert_eq!(pending[1].id, e2.id);

        mark_mutation_status(&db, &e1.id, "SYNCED").expect("mark synced");
        assert_eq!(pending_mutations_count(&db).expect("count"), 1);

        set_network_online(true);
        assert!(is_network_online());
    }

    #[test]
    fn enqueues_mutation_with_client_id_and_metadata() {
        let passkey = DbPasskey::new("secret-meta");
        let db = EncryptedDb::open_in_memory(&passkey).expect("db");

        let event = enqueue_mutation_with_metadata(
            &db,
            "ws-99",
            "usr-88",
            "DEVICE",
            "dev-1",
            "UPDATE",
            r#"{"sampling_rate":50}"#,
            2000,
        )
        .expect("enqueue with meta");

        let envelope: SyncPayloadEnvelope =
            serde_json::from_str(&event.payload).expect("parse envelope");
        assert_eq!(envelope.workspace_id, "ws-99");
        assert_eq!(envelope.user_id, "usr-88");
        assert_eq!(envelope.entity_type, "DEVICE");
        assert_eq!(envelope.entity_id, "dev-1");
        assert!(Uuid::parse_str(&envelope.client_id).is_ok());
        assert_eq!(
            envelope.field_changes.get("sampling_rate").unwrap(),
            &serde_json::json!(50)
        );
    }
}
