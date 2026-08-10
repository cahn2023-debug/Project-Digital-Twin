use sha2::{Digest, Sha256};
use zeroize::Zeroize;

/// Secure passkey container for SQLCipher & local field-level payload encryption
#[derive(Debug, Clone, Zeroize)]
#[zeroize(drop)]
pub struct DbPasskey {
    key: String,
    raw_bytes: [u8; 32],
}

impl DbPasskey {
    /// Create a new DbPasskey from a raw secret string
    pub fn new(secret: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(secret.as_bytes());
        let result = hasher.finalize();
        let hex_key = format!("{:x}", result);
        let mut raw_bytes = [0u8; 32];
        raw_bytes.copy_from_slice(&result);

        Self {
            key: hex_key,
            raw_bytes,
        }
    }

    /// Returns the hex string for PRAGMA key
    pub fn as_pragma_key(&self) -> &str {
        &self.key
    }

    /// Encrypt a string payload using stream XOR cipher with Sha256 key schedule
    pub fn encrypt(&self, plaintext: &str) -> String {
        let mut cipher_bytes = Vec::with_capacity(plaintext.len());
        for (i, &b) in plaintext.as_bytes().iter().enumerate() {
            let key_byte = self.raw_bytes[i % 32];
            cipher_bytes.push(b ^ key_byte);
        }
        format!("ENC:{}", hex::encode(cipher_bytes))
    }

    /// Decrypt an encrypted string payload
    pub fn decrypt(&self, ciphertext: &str) -> Result<String, String> {
        if !ciphertext.starts_with("ENC:") {
            return Ok(ciphertext.to_string());
        }
        let hex_data = &ciphertext[4..];
        let bytes = hex::decode(hex_data).map_err(|e| e.to_string())?;
        let mut plain_bytes = Vec::with_capacity(bytes.len());
        for (i, &b) in bytes.iter().enumerate() {
            let key_byte = self.raw_bytes[i % 32];
            plain_bytes.push(b ^ key_byte);
        }
        String::from_utf8(plain_bytes).map_err(|e| e.to_string())
    }
}

// Minimal hex helper module to avoid extra crate dependency
mod hex {
    pub fn encode(data: impl AsRef<[u8]>) -> String {
        data.as_ref().iter().map(|b| format!("{:02x}", b)).collect()
    }

    pub fn decode(hex_str: &str) -> Result<Vec<u8>, String> {
        if hex_str.len() % 2 != 0 {
            return Err("Invalid hex string length".to_string());
        }
        (0..hex_str.len())
            .step_by(2)
            .map(|i| {
                u8::from_str_radix(&hex_str[i..i + 2], 16).map_err(|e| e.to_string())
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_deterministic_passkey() {
        let key1 = DbPasskey::new("my-secret-passphrase");
        let key2 = DbPasskey::new("my-secret-passphrase");
        assert_eq!(key1.as_pragma_key(), key2.as_pragma_key());
        assert_eq!(key1.as_pragma_key().len(), 64);
    }

    #[test]
    fn encrypts_and_decrypts_payloads() {
        let key = DbPasskey::new("my-secret-passphrase");
        let secret_text = "jwt_token_secret_value_123";
        let encrypted = key.encrypt(secret_text);
        assert!(encrypted.starts_with("ENC:"));

        let decrypted = key.decrypt(&encrypted).expect("decrypt");
        assert_eq!(decrypted, secret_text);
    }
}
