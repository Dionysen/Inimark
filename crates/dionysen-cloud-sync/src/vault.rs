//! Encrypted on-disk vault for OAuth tokens and OSS credentials.
//!
//! File lives under the shared app-support dir `com.dionysen.cloud-sync/vault.enc`
//! so sibling Dionysen apps can discover each other's login profiles.

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
use crate::oauth::OauthRegion;

const VAULT_VERSION: u32 = 1;
const APP_SUPPORT_DIR: &str = "com.dionysen.cloud-sync";
const VAULT_FILE: &str = "vault.enc";
/// Application-wide salt; combined with machine material for key derivation.
const KEY_SALT: &[u8] = b"dionysen-cloud-sync-vault-v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OauthRecord {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: i64,
    pub token_type: String,
    pub id_token: Option<String>,
    pub sub: Option<String>,
    pub uid: Option<String>,
    pub aid: Option<String>,
    pub login_name: Option<String>,
    pub name: Option<String>,
    pub region: String,
    pub client_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OssRecord {
    pub endpoint: String,
    pub bucket: String,
    pub access_key_id: String,
    pub access_key_secret: String,
    #[serde(default)]
    pub prefix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppProfile {
    pub oauth: Option<OauthRecord>,
    pub oss: Option<OssRecord>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingAuth {
    pub app_id: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub region: String,
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
pub struct AppProfileSummary {
    pub app_id: String,
    pub logged_in: bool,
    pub uid: Option<String>,
    pub login_name: Option<String>,
    pub name: Option<String>,
    pub region: Option<String>,
    pub has_oss: bool,
    pub oss: Option<OssConfigPublic>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OssConfigPublic {
    pub endpoint: String,
    pub bucket: String,
    pub access_key_id: String,
    pub prefix: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OssConfigInput {
    pub endpoint: String,
    pub bucket: String,
    pub access_key_id: String,
    pub access_key_secret: String,
    #[serde(default)]
    pub prefix: String,
}

pub struct Vault {
    path: PathBuf,
    inner: Mutex<VaultPayload>,
}

impl Vault {
    pub fn open_default() -> Result<Self> {
        let path = default_vault_path()?;
        Self::open(path)
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
            let Some(profile) = p.profiles.get_mut(app_id) else {
                return Ok(None);
            };
            let old = profile.oauth.take();
            profile.updated_at = now_secs();
            Ok(old)
        })
    }

    pub fn get_oauth(&self, app_id: &str) -> Result<Option<OauthRecord>> {
        self.with_ref(|p| Ok(p.profiles.get(app_id).and_then(|x| x.oauth.clone())))
    }

    pub fn set_oss(&self, app_id: &str, oss: OssRecord) -> Result<()> {
        self.with_mut(|p| {
            let profile = p.profiles.entry(app_id.to_string()).or_default();
            profile.oss = Some(oss);
            profile.updated_at = now_secs();
            Ok(())
        })
    }

    pub fn clear_oss(&self, app_id: &str) -> Result<()> {
        self.with_mut(|p| {
            if let Some(profile) = p.profiles.get_mut(app_id) {
                profile.oss = None;
                profile.updated_at = now_secs();
            }
            Ok(())
        })
    }

    pub fn get_oss(&self, app_id: &str) -> Result<Option<OssRecord>> {
        self.with_ref(|p| Ok(p.profiles.get(app_id).and_then(|x| x.oss.clone())))
    }

    pub fn profile_summary(&self, app_id: &str) -> Result<AppProfileSummary> {
        self.with_ref(|p| {
            let profile = p.profiles.get(app_id);
            Ok(summarize(app_id, profile))
        })
    }

    pub fn sibling_summaries(&self, current_app_id: &str) -> Result<Vec<AppProfileSummary>> {
        self.with_ref(|p| {
            let mut out = Vec::new();
            for (app_id, profile) in &p.profiles {
                if app_id == current_app_id {
                    continue;
                }
                if profile.oauth.is_none() {
                    continue;
                }
                out.push(summarize(app_id, Some(profile)));
            }
            out.sort_by(|a, b| a.app_id.cmp(&b.app_id));
            Ok(out)
        })
    }

    /// Copy oauth (and optionally oss) from one profile to another.
    pub fn adopt_session(
        &self,
        from_app_id: &str,
        to_app_id: &str,
        copy_oss: bool,
    ) -> Result<AppProfileSummary> {
        self.with_mut(|p| {
            let source = p
                .profiles
                .get(from_app_id)
                .cloned()
                .ok_or_else(|| Error::msg(format!("no profile for {from_app_id}")))?;
            let oauth = source
                .oauth
                .ok_or_else(|| Error::msg(format!("{from_app_id} is not logged in")))?;
            let dest = p.profiles.entry(to_app_id.to_string()).or_default();
            dest.oauth = Some(oauth);
            if copy_oss {
                dest.oss = source.oss;
            }
            dest.updated_at = now_secs();
            Ok(summarize(to_app_id, Some(dest)))
        })
    }
}

fn summarize(app_id: &str, profile: Option<&AppProfile>) -> AppProfileSummary {
    match profile {
        None => AppProfileSummary {
            app_id: app_id.to_string(),
            logged_in: false,
            uid: None,
            login_name: None,
            name: None,
            region: None,
            has_oss: false,
            oss: None,
            updated_at: 0,
        },
        Some(p) => {
            let (uid, login_name, name, region, logged_in) = match &p.oauth {
                Some(o) => (
                    o.uid.clone(),
                    o.login_name.clone(),
                    o.name.clone(),
                    Some(o.region.clone()),
                    true,
                ),
                None => (None, None, None, None, false),
            };
            let oss = p.oss.as_ref().map(|o| OssConfigPublic {
                endpoint: o.endpoint.clone(),
                bucket: o.bucket.clone(),
                access_key_id: o.access_key_id.clone(),
                prefix: o.prefix.clone(),
            });
            AppProfileSummary {
                app_id: app_id.to_string(),
                logged_in,
                uid,
                login_name,
                name,
                region,
                has_oss: oss.is_some(),
                oss,
                updated_at: p.updated_at,
            }
        }
    }
}

pub fn default_vault_path() -> Result<PathBuf> {
    let base = dirs::data_dir().ok_or_else(|| Error::msg("cannot resolve app data dir"))?;
    Ok(base.join(APP_SUPPORT_DIR).join(VAULT_FILE))
}

pub fn now_secs() -> i64 {
    chrono::Utc::now().timestamp()
}

pub fn parse_region(s: &str) -> Result<OauthRegion> {
    match s {
        "cn" => Ok(OauthRegion::Cn),
        "intl" => Ok(OauthRegion::Intl),
        other => Err(Error::msg(format!("unknown oauth region: {other}"))),
    }
}

fn machine_material() -> Vec<u8> {
    let host = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "unknown-host".into());
    let user = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown-user".into());
    format!("{host}:{user}:dionysen-cloud-sync").into_bytes()
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
    fn roundtrip_oauth_and_adopt() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("vault.enc");
        let vault = Vault::open(&path).unwrap();

        vault
            .set_oauth(
                "inimark",
                OauthRecord {
                    access_token: "at".into(),
                    refresh_token: Some("rt".into()),
                    expires_at: now_secs() + 3600,
                    token_type: "Bearer".into(),
                    id_token: None,
                    sub: Some("sub".into()),
                    uid: Some("123".into()),
                    aid: Some("456".into()),
                    login_name: Some("alice".into()),
                    name: Some("Alice".into()),
                    region: "cn".into(),
                    client_id: "cid".into(),
                },
            )
            .unwrap();

        let siblings = vault.sibling_summaries("vellum").unwrap();
        assert_eq!(siblings.len(), 1);
        assert_eq!(siblings[0].app_id, "inimark");
        assert_eq!(siblings[0].uid.as_deref(), Some("123"));

        let adopted = vault.adopt_session("inimark", "vellum", false).unwrap();
        assert!(adopted.logged_in);
        assert_eq!(adopted.uid.as_deref(), Some("123"));
        assert!(!adopted.has_oss);

        // Reload from disk
        let vault2 = Vault::open(&path).unwrap();
        let session = vault2.get_oauth("vellum").unwrap().unwrap();
        assert_eq!(session.access_token, "at");
    }
}
