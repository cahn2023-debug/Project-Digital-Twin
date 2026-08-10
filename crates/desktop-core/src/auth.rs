use crate::db_encrypted::{CachedCredential, DbResult, EncryptedDb};
use sha2::{Digest, Sha256};

#[derive(Debug, PartialEq, Eq)]
pub enum AuthResult {
    Success(CachedCredential),
    InvalidCredentials,
    TokenExpired,
    NoCachedSession,
}

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn cache_session(
    db: &EncryptedDb,
    user_id: &str,
    username: &str,
    password: &str,
    jwt_token: &str,
    expires_at: &str,
    now_timestamp: &str,
) -> DbResult<()> {
    let pass_hash = hash_password(password);
    let cred = CachedCredential {
        id: format!("session-{}", user_id),
        user_id: user_id.to_string(),
        username: username.to_string(),
        password_hash: pass_hash,
        jwt_token: jwt_token.to_string(),
        expires_at: expires_at.to_string(),
        updated_at: now_timestamp.to_string(),
    };

    db.save_cached_credential(&cred)
}

pub fn validate_offline_login(
    db: &EncryptedDb,
    user_id: &str,
    password: &str,
    current_timestamp_iso: &str,
) -> DbResult<AuthResult> {
    match db.get_cached_credential(user_id)? {
        Some(cred) => {
            let input_hash = hash_password(password);
            if cred.password_hash != input_hash {
                return Ok(AuthResult::InvalidCredentials);
            }

            if current_timestamp_iso > cred.expires_at.as_str() {
                return Ok(AuthResult::TokenExpired);
            }

            Ok(AuthResult::Success(cred))
        }
        None => Ok(AuthResult::NoCachedSession),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::DbPasskey;

    #[test]
    fn caches_and_authenticates_offline_user() {
        let passkey = DbPasskey::new("secret");
        let db = EncryptedDb::open_in_memory(&passkey).expect("db");

        cache_session(
            &db,
            "u-100",
            "alice",
            "secret_pass_123",
            "mock_jwt_token",
            "2030-01-01T00:00:00Z",
            "2026-08-10T08:00:00Z",
        )
        .expect("cache session");

        // Test valid login
        let res = validate_offline_login(&db, "u-100", "secret_pass_123", "2026-08-10T08:30:00Z")
            .expect("validate");
        if let AuthResult::Success(cred) = res {
            assert_eq!(cred.username, "alice");
            assert_eq!(cred.jwt_token, "mock_jwt_token");
        } else {
            panic!("Expected AuthResult::Success");
        }

        // Test invalid password
        let res_bad = validate_offline_login(&db, "u-100", "wrong_pass", "2026-08-10T08:30:00Z")
            .expect("validate");
        assert_eq!(res_bad, AuthResult::InvalidCredentials);

        // Test expired token
        let res_exp =
            validate_offline_login(&db, "u-100", "secret_pass_123", "2031-01-01T00:00:00Z")
                .expect("validate");
        assert_eq!(res_exp, AuthResult::TokenExpired);
    }
}
