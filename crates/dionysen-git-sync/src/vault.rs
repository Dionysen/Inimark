//! Encrypted vault for GitHub/Gitee tokens and sync metadata.
//! Path: `{data_dir}/com.dionysen.git-sync/vault.enc`

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

const VAULT_VERSION: u32 = 1;
const APP_SUPPORT_DIR: &str = "com.dionysen.git-sync";
const VAULT_FILE: &str = "vault.enc";
const KEY_SALT: &[u8] = b"dionysen-git-sync-vault-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GitProvider {
    Github,
    Gitee,
}

impl GitProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Github => "github",
            Self::Gitee => "gitee",
        }
    }

    pub fn parse(s: &str) -> Result<Self> {
        match s {
            "github" => Ok(Self::Github),
            "gitee" => Ok(Self::Gitee),
            other => Err(Error::msg(format!("unknown git provider: {other}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OauthRecord {
    pub provider: GitProvider,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub token_type: String,
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub client_id: String,
    /// Gitee may require a client secret at token exchange time.
    pub client_secret: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoBinding {
    pub full_name: String,
    pub owner: String,
    pub name: String,
    pub private: bool,
    pub html_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncMeta {
    pub last_sync_at: Option<i64>,
    pub last_push_at: Option<i64>,
    pub last_pull_at: Option<i64>,
    pub last_room_mtime: Option<i64>,
    pub last_export_hash: Option<String>,
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppProfile {
    pub oauth: Option<OauthRecord>,
    pub repo: Option<RepoBinding>,
    pub sync: SyncMeta,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingAuth {
    pub app_id: String,
    pub provider: GitProvider,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    pub code_verifier: String,
    pub state: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultPayload {
    pub profiles: HashMap<String, AppProfile>,
    pub pending: Option<PendingAuth>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VaultEnvelope {
    version: u32,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub logged_in: bool,
    pub provider: Option<String>,
    pub login: Option<String>,
    pub name: Option<String>,
    pub repo_full_name: Option<String>,
    pub last_sync_at: Option<i64>,
    pub configured: bool,
}

pub struct Vault {
    path: PathBuf,
    inner: Mutex<VaultPayload>,
}

impl Vault {
    pub fn open_default() -> Result<Self> {
        Self::open(default_vault_path()?)
    }

    pub fn open(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let payload = if path.exists() {
            decrypt_file(&path)?
        } else {
            VaultPayload::default()
        };
        Ok(Self {
            path,
            inner: Mutex::new(payload),
        })
    }

    fn with_mut<R>(&self, f: impl FnOnce(&mut VaultPayload) -> Result<R>) -> Result<R> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| Error::msg("vault lock poisoned"))?;
        let result = f(&mut guard)?;
        encrypt_file(&self.path, &guard)?;
        Ok(result)
    }

    fn with_ref<R>(&self, f: impl FnOnce(&VaultPayload) -> Result<R>) -> Result<R> {
        let guard = self
            .inner
            .lock()
            .map_err(|_| Error::msg("vault lock poisoned"))?;
        f(&guard)
    }

    pub fn begin_oauth(&self, pending: PendingAuth) -> Result<()> {
        self.with_mut(|p| {
            p.pending = Some(pending);
            Ok(())
        })
    }

    pub fn take_pending(&self) -> Result<Option<PendingAuth>> {
        self.with_mut(|p| Ok(p.pending.take()))
    }

    pub fn restore_pending(&self, pending: PendingAuth) -> Result<()> {
        self.with_mut(|p| {
            p.pending = Some(pending);
            Ok(())
        })
    }

    pub fn set_oauth(&self, app_id: &str, oauth: OauthRecord) -> Result<()> {
        self.with_mut(|p| {
            let profile = p.profiles.entry(app_id.to_string()).or_default();
            profile.oauth = Some(oauth);
            profile.updated_at = now_secs();
            Ok(())
        })
    }

    pub fn clear_oauth(&self, app_id: &str) -> Result<Option<OauthRecord>> {
        self.with_mut(|p| {
            if let Some(profile) = p.profiles.get_mut(app_id) {
                let old = profile.oauth.take();
                profile.repo = None;
                profile.sync = SyncMeta::default();
                profile.updated_at = now_secs();
                Ok(old)
            } else {
                Ok(None)
            }
        })
    }

    pub fn get_oauth(&self, app_id: &str) -> Result<Option<OauthRecord>> {
        self.with_ref(|p| Ok(p.profiles.get(app_id).and_then(|x| x.oauth.clone())))
    }

    pub fn set_repo(&self, app_id: &str, repo: RepoBinding) -> Result<()> {
        self.with_mut(|p| {
            let profile = p.profiles.entry(app_id.to_string()).or_default();
            profile.repo = Some(repo);
            profile.updated_at = now_secs();
            Ok(())
        })
    }

    pub fn get_repo(&self, app_id: &str) -> Result<Option<RepoBinding>> {
        self.with_ref(|p| Ok(p.profiles.get(app_id).and_then(|x| x.repo.clone())))
    }

    pub fn get_sync_meta(&self, app_id: &str) -> Result<SyncMeta> {
        self.with_ref(|p| {
            Ok(p.profiles
                .get(app_id)
                .map(|x| x.sync.clone())
                .unwrap_or_default())
        })
    }

    pub fn update_sync_meta(&self, app_id: &str, f: impl FnOnce(&mut SyncMeta)) -> Result<()> {
        self.with_mut(|p| {
            let profile = p.profiles.entry(app_id.to_string()).or_default();
            f(&mut profile.sync);
            profile.updated_at = now_secs();
            Ok(())
        })
    }

    pub fn session_summary(&self, app_id: &str) -> Result<SessionSummary> {
        self.with_ref(|p| {
            let Some(profile) = p.profiles.get(app_id) else {
                return Ok(SessionSummary {
                    logged_in: false,
                    provider: None,
                    login: None,
                    name: None,
                    repo_full_name: None,
                    last_sync_at: None,
                    configured: false,
                });
            };
            let logged_in = profile.oauth.is_some();
            Ok(SessionSummary {
                logged_in,
                provider: profile.oauth.as_ref().map(|o| o.provider.as_str().to_string()),
                login: profile.oauth.as_ref().map(|o| o.login.clone()),
                name: profile.oauth.as_ref().and_then(|o| o.name.clone()),
                repo_full_name: profile.repo.as_ref().map(|r| r.full_name.clone()),
                last_sync_at: profile.sync.last_sync_at,
                configured: logged_in && profile.repo.is_some(),
            })
        })
    }
}

pub fn default_vault_path() -> Result<PathBuf> {
    let base = dirs::data_dir().ok_or_else(|| Error::msg("cannot resolve app data dir"))?;
    Ok(base.join(APP_SUPPORT_DIR).join(VAULT_FILE))
}

pub fn now_secs() -> i64 {
    chrono::Utc::now().timestamp()
}

pub fn device_id() -> String {
    use sha2::{Digest, Sha256};
    let host = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "host".into());
    let user = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "user".into());
    let raw = format!("{host}-{user}");
    let digest = Sha256::digest(raw.as_bytes());
    hex::encode(&digest[..6])
}

fn machine_material() -> Vec<u8> {
    let host = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "unknown-host".into());
    let user = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown-user".into());
    format!("{host}:{user}:dionysen-git-sync").into_bytes()
}

fn derive_key() -> Result<[u8; 32]> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(&machine_material(), KEY_SALT, &mut key)
        .map_err(|e| Error::Crypto(e.to_string()))?;
    Ok(key)
}

fn encrypt_file(path: &Path, payload: &VaultPayload) -> Result<()> {
    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| Error::Crypto(e.to_string()))?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let plaintext = serde_json::to_vec(payload)?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext.as_ref())
        .map_err(|e| Error::Crypto(e.to_string()))?;
    let envelope = VaultEnvelope {
        version: VAULT_VERSION,
        nonce: B64.encode(nonce_bytes),
        ciphertext: B64.encode(ciphertext),
    };
    let tmp = path.with_extension("enc.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(&envelope)?)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

fn decrypt_file(path: &Path) -> Result<VaultPayload> {
    let raw = fs::read(path)?;
    let envelope: VaultEnvelope = serde_json::from_slice(&raw)?;
    if envelope.version != VAULT_VERSION {
        return Err(Error::msg(format!(
            "unsupported vault version {}",
            envelope.version
        )));
    }
    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| Error::Crypto(e.to_string()))?;
    let nonce = B64
        .decode(envelope.nonce.as_bytes())
        .map_err(|e| Error::Crypto(e.to_string()))?;
    let ciphertext = B64
        .decode(envelope.ciphertext.as_bytes())
        .map_err(|e| Error::Crypto(e.to_string()))?;
    if nonce.len() != 12 {
        return Err(Error::Crypto("invalid nonce length".into()));
    }
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| Error::Crypto("vault decrypt failed (wrong machine?)".into()))?;
    Ok(serde_json::from_slice(&plaintext)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn roundtrip_session() {
        let dir = TempDir::new().unwrap();
        let vault = Vault::open(dir.path().join("vault.enc")).unwrap();
        vault
            .set_oauth(
                "vellum",
                OauthRecord {
                    provider: GitProvider::Github,
                    access_token: "tok".into(),
                    refresh_token: None,
                    expires_at: None,
                    token_type: "bearer".into(),
                    login: "alice".into(),
                    name: Some("Alice".into()),
                    avatar_url: None,
                    client_id: "cid".into(),
                    client_secret: None,
                },
            )
            .unwrap();
        vault
            .set_repo(
                "vellum",
                RepoBinding {
                    full_name: "alice/vellum-pwb-sync".into(),
                    owner: "alice".into(),
                    name: "vellum-pwb-sync".into(),
                    private: true,
                    html_url: None,
                },
            )
            .unwrap();
        let s = vault.session_summary("vellum").unwrap();
        assert!(s.logged_in);
        assert_eq!(s.login.as_deref(), Some("alice"));
        assert!(s.configured);
    }
}
