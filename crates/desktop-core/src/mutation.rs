use crate::db_encrypted::{DbResult, EncryptedDb, MutationEvent};
use std::sync::atomic::{AtomicBool, Ordering};

pub static IS_ONLINE: AtomicBool = AtomicBool::new(false);

pub fn set_network_online(online: bool) {
    IS_ONLINE.store(online, Ordering::SeqCst);
}

pub fn is_network_online() -> bool {
    IS_ONLINE.load(Ordering::SeqCst)
}

pub fn enqueue_mutation(
    db: &EncryptedDb,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    payload: &str,
    now_timestamp: i64,
) -> DbResult<MutationEvent> {
    let event = MutationEvent {
        id: format!("evt-{}", now_timestamp),
        entity_type: entity_type.to_string(),
        entity_id: entity_id.to_string(),
        action: action.to_string(),
        payload: payload.to_string(),
        timestamp: now_timestamp,
        status: "PENDING".to_string(),
        retry_count: 0,
    };

    db.push_mutation_event(&event)?;
    Ok(event)
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
}
