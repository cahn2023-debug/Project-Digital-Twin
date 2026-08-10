use crate::crypto::DbPasskey;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug)]
pub enum DbError {
    Sqlite(rusqlite::Error),
    EncryptionVerificationFailed,
    DecryptionFailed(String),
}

impl From<rusqlite::Error> for DbError {
    fn from(err: rusqlite::Error) -> Self {
        DbError::Sqlite(err)
    }
}

pub type DbResult<T> = Result<T, DbError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CachedCredential {
    pub id: String,
    pub user_id: String,
    pub username: String,
    pub password_hash: String,
    pub jwt_token: String,
    pub expires_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutationEvent {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub payload: String,
    pub timestamp: i64,
    pub status: String,
    pub retry_count: i32,
}

pub struct EncryptedDb {
    conn: Connection,
    passkey: DbPasskey,
}

impl EncryptedDb {
    /// Opens an encrypted SQLite database at the specified path and verifies passkey
    pub fn open(path: &Path, passkey: &DbPasskey) -> DbResult<Self> {
        let conn = Connection::open(path)?;
        Self::configure_connection(&conn, passkey)?;
        let db = Self {
            conn,
            passkey: passkey.clone(),
        };
        db.init_schema_and_verify_sentinel()?;
        Ok(db)
    }

    /// Opens an in-memory encrypted SQLite database
    pub fn open_in_memory(passkey: &DbPasskey) -> DbResult<Self> {
        let conn = Connection::open_in_memory()?;
        Self::configure_connection(&conn, passkey)?;
        let db = Self {
            conn,
            passkey: passkey.clone(),
        };
        db.init_schema_and_verify_sentinel()?;
        Ok(db)
    }

    fn configure_connection(conn: &Connection, passkey: &DbPasskey) -> DbResult<()> {
        let pragma_sql = format!("PRAGMA key = '{}';", passkey.as_pragma_key());
        conn.execute_batch(&pragma_sql)?;

        let test_query: SqlResult<i64> =
            conn.query_row("SELECT count(*) FROM sqlite_master;", [], |row| row.get(0));

        if test_query.is_err() {
            return Err(DbError::EncryptionVerificationFailed);
        }

        Ok(())
    }

    fn init_schema_and_verify_sentinel(&self) -> DbResult<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS _db_key_sentinel (
                id INTEGER PRIMARY KEY,
                sentinel_val TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cached_credentials (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                jwt_token TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS mutation_events (
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                payload TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                retry_count INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sync_checkpoints (
                id TEXT PRIMARY KEY,
                scope TEXT NOT NULL,
                cursor_id INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_mutation_status ON mutation_events(status);
            CREATE INDEX IF NOT EXISTS idx_mutation_timestamp ON mutation_events(timestamp);
            ",
        )?;

        // Check or create sentinel record
        let existing: SqlResult<String> = self.conn.query_row(
            "SELECT sentinel_val FROM _db_key_sentinel WHERE id = 1;",
            [],
            |row| row.get(0),
        );

        match existing {
            Ok(cipher_sentinel) => match self.passkey.decrypt(&cipher_sentinel) {
                Ok(plain) if plain == "SENTINEL_OK" => Ok(()),
                _ => Err(DbError::EncryptionVerificationFailed),
            },
            Err(_) => {
                let cipher_sentinel = self.passkey.encrypt("SENTINEL_OK");
                self.conn.execute(
                    "INSERT INTO _db_key_sentinel (id, sentinel_val) VALUES (1, ?1);",
                    params![cipher_sentinel],
                )?;
                Ok(())
            }
        }
    }

    pub fn is_encrypted_and_healthy(&self) -> bool {
        self.conn
            .query_row("SELECT count(*) FROM sqlite_master;", [], |_| Ok(()))
            .is_ok()
    }

    pub fn save_cached_credential(&self, cred: &CachedCredential) -> DbResult<()> {
        let enc_jwt = self.passkey.encrypt(&cred.jwt_token);
        let enc_hash = self.passkey.encrypt(&cred.password_hash);

        self.conn.execute(
            "INSERT OR REPLACE INTO cached_credentials 
            (id, user_id, username, password_hash, jwt_token, expires_at, updated_at) 
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
            params![
                cred.id,
                cred.user_id,
                cred.username,
                enc_hash,
                enc_jwt,
                cred.expires_at,
                cred.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_cached_credential(&self, user_id: &str) -> DbResult<Option<CachedCredential>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, user_id, username, password_hash, jwt_token, expires_at, updated_at 
             FROM cached_credentials WHERE user_id = ?1 LIMIT 1;",
        )?;
        let mut rows = stmt.query(params![user_id])?;

        if let Some(row) = rows.next()? {
            let enc_hash: String = row.get(3)?;
            let enc_jwt: String = row.get(4)?;

            let password_hash = self
                .passkey
                .decrypt(&enc_hash)
                .map_err(DbError::DecryptionFailed)?;
            let jwt_token = self
                .passkey
                .decrypt(&enc_jwt)
                .map_err(DbError::DecryptionFailed)?;

            Ok(Some(CachedCredential {
                id: row.get(0)?,
                user_id: row.get(1)?,
                username: row.get(2)?,
                password_hash,
                jwt_token,
                expires_at: row.get(5)?,
                updated_at: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn push_mutation_event(&self, event: &MutationEvent) -> DbResult<()> {
        let enc_payload = self.passkey.encrypt(&event.payload);

        self.conn.execute(
            "INSERT INTO mutation_events 
            (id, entity_type, entity_id, action, payload, timestamp, status, retry_count) 
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
            params![
                event.id,
                event.entity_type,
                event.entity_id,
                event.action,
                enc_payload,
                event.timestamp,
                event.status,
                event.retry_count
            ],
        )?;
        Ok(())
    }

    pub fn get_pending_mutation_events(&self, limit: usize) -> DbResult<Vec<MutationEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, entity_type, entity_id, action, payload, timestamp, status, retry_count 
             FROM mutation_events WHERE status = 'PENDING' 
             ORDER BY timestamp ASC LIMIT ?1;",
        )?;
        let mut rows = stmt.query(params![limit as i64])?;
        let mut events = Vec::new();

        while let Some(row) = rows.next()? {
            let enc_payload: String = row.get(4)?;
            let payload = self
                .passkey
                .decrypt(&enc_payload)
                .map_err(DbError::DecryptionFailed)?;

            events.push(MutationEvent {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                action: row.get(3)?,
                payload,
                timestamp: row.get(5)?,
                status: row.get(6)?,
                retry_count: row.get(7)?,
            });
        }

        Ok(events)
    }

    pub fn update_mutation_status(&self, event_id: &str, status: &str) -> DbResult<()> {
        self.conn.execute(
            "UPDATE mutation_events SET status = ?1 WHERE id = ?2;",
            params![status, event_id],
        )?;
        Ok(())
    }

    pub fn pending_event_count(&self) -> DbResult<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT count(*) FROM mutation_events WHERE status = 'PENDING';",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypted_db_in_memory_initializes_tables() {
        let passkey = DbPasskey::new("test-passkey");
        let db = EncryptedDb::open_in_memory(&passkey).expect("open encrypted db");
        assert!(db.is_encrypted_and_healthy());
    }

    #[test]
    fn encrypted_db_file_rejects_wrong_key() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("encrypted.sqlite");
        let passkey_right = DbPasskey::new("correct-secret");
        let passkey_wrong = DbPasskey::new("wrong-secret");

        {
            let db = EncryptedDb::open(&db_path, &passkey_right).expect("open with right key");
            db.push_mutation_event(&MutationEvent {
                id: "event-1".to_string(),
                entity_type: "PROJECT".to_string(),
                entity_id: "p-100".to_string(),
                action: "CREATE".to_string(),
                payload: "{}".to_string(),
                timestamp: 1000,
                status: "PENDING".to_string(),
                retry_count: 0,
            })
            .expect("push event");
        }

        // Reopening with wrong key must fail
        let reopen_result = EncryptedDb::open(&db_path, &passkey_wrong);
        assert!(reopen_result.is_err());
    }

    #[test]
    fn saves_and_retrieves_credentials_and_events() {
        let passkey = DbPasskey::new("auth-secret");
        let db = EncryptedDb::open_in_memory(&passkey).expect("open");

        let cred = CachedCredential {
            id: "c-1".to_string(),
            user_id: "u-123".to_string(),
            username: "admin".to_string(),
            password_hash: "argon2id_hash".to_string(),
            jwt_token: "jwt_token_sample".to_string(),
            expires_at: "2026-12-31T23:59:59Z".to_string(),
            updated_at: "2026-08-10T08:00:00Z".to_string(),
        };

        db.save_cached_credential(&cred).expect("save cred");
        let retrieved = db
            .get_cached_credential("u-123")
            .expect("get cred")
            .expect("cred exists");
        assert_eq!(retrieved.username, "admin");
        assert_eq!(retrieved.jwt_token, "jwt_token_sample");

        let event = MutationEvent {
            id: "evt-001".to_string(),
            entity_type: "CAMERA".to_string(),
            entity_id: "cam-1".to_string(),
            action: "UPDATE".to_string(),
            payload: r#"{"status":"ACTIVE"}"#.to_string(),
            timestamp: 1700000000,
            status: "PENDING".to_string(),
            retry_count: 0,
        };

        db.push_mutation_event(&event).expect("push event");
        assert_eq!(db.pending_event_count().expect("count"), 1);

        let pending = db.get_pending_mutation_events(10).expect("get pending");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, "evt-001");
        assert_eq!(pending[0].payload, r#"{"status":"ACTIVE"}"#);

        db.update_mutation_status("evt-001", "SYNCED")
            .expect("update status");
        assert_eq!(db.pending_event_count().expect("count"), 0);
    }
}
