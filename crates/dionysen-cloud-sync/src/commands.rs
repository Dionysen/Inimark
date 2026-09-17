//! Tauri commands for cloud-sync vault, OAuth, and OSS.

use std::sync::Mutex;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::error::Error;
use crate::oauth::{
    build_authorize_url, exchange_code, refresh_access_token, resolve_browser_login_url,
    revoke_refresh_token, session_from_record, SessionSummary, SiblingSession,
};
use crate::oss::{OssClient, OssObjectMeta, OssObjectSummary};
use crate::vault::{
    now_secs, parse_region, AppProfileSummary, OssConfigInput, OssRecord, PendingAuth, Vault,
};

type CmdResult<T> = std::result::Result<T, String>;

/// Window label for the in-app Aliyun login webview.
pub const OAUTH_WINDOW_LABEL: &str = "oauth-login";
/// Frontend listens for this when the webview hits `vellum://oauth/callback?...`.
pub const OAUTH_CALLBACK_EVENT: &str = "cloud-sync-oauth-callback";

pub struct CloudSyncState {
    vault: Mutex<Vault>,
}

impl CloudSyncState {
    pub fn new() -> Result<Self, Error> {
        Ok(Self {
            vault: Mutex::new(Vault::open_default()?),
        })
    }
}

fn vault(state: &CloudSyncState) -> CmdResult<std::sync::MutexGuard<'_, Vault>> {
    state
        .vault
        .lock()
        .map_err(|_| "vault lock poisoned".to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginOauthInput {
    pub app_id: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub region: String,
    pub code_verifier: String,
    pub code_challenge: String,
    pub state: String,
    #[serde(default = "default_scope")]
    pub scope: String,
}

fn default_scope() -> String {
    "openid aliuid profile".into()
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginOauthResult {
    pub authorize_url: String,
    /// Prefer opening this in the system browser (usually `login.htm?...`).
    pub browser_url: String,
}

#[tauri::command]
pub fn cs_begin_oauth(
    state: State<'_, CloudSyncState>,
    input: BeginOauthInput,
) -> CmdResult<BeginOauthResult> {
    let region = parse_region(&input.region)?;
    let pending = PendingAuth {
        app_id: input.app_id,
        client_id: input.client_id.clone(),
        redirect_uri: input.redirect_uri.clone(),
        region: input.region.clone(),
        code_verifier: input.code_verifier,
        state: input.state.clone(),
        created_at: now_secs(),
    };
    vault(&state)?.begin_oauth(pending)?;
    let authorize_url = build_authorize_url(
        region,
        &input.client_id,
        &input.redirect_uri,
        &input.state,
        &input.code_challenge,
        &input.scope,
    );
    let browser_url = resolve_browser_login_url(&authorize_url, region)
        .unwrap_or_else(|_| authorize_url.clone());
    Ok(BeginOauthResult {
        authorize_url,
        browser_url,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteOauthInput {
    pub code: String,
    pub state: String,
}

#[tauri::command]
pub fn cs_complete_oauth(
    state: State<'_, CloudSyncState>,
    input: CompleteOauthInput,
) -> CmdResult<AppProfileSummary> {
    let v = vault(&state)?;
    let pending = v
        .take_pending()?
        .ok_or_else(|| crate::error::Error::msg("no pending oauth"))?;
    if pending.state != input.state {
        return Err(crate::error::Error::Oauth("state mismatch".into()).into());
    }
    if now_secs() - pending.created_at > 600 {
        return Err(crate::error::Error::Oauth("pending oauth expired".into()).into());
    }
    let region = parse_region(&pending.region)?;
    let record = exchange_code(
        region,
        &pending.client_id,
        &pending.redirect_uri,
        &input.code,
        &pending.code_verifier,
    )?;
    let app_id = pending.app_id.clone();
    v.set_oauth(&app_id, record)?;
    Ok(v.profile_summary(&app_id)?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppIdInput {
    pub app_id: String,
}

#[tauri::command]
pub fn cs_get_session(
    state: State<'_, CloudSyncState>,
    input: AppIdInput,
) -> CmdResult<SessionSummary> {
    let record = vault(&state)?.get_oauth(&input.app_id)?;
    Ok(session_from_record(record.as_ref()))
}

#[tauri::command]
pub fn cs_get_profile(
    state: State<'_, CloudSyncState>,
    input: AppIdInput,
) -> CmdResult<AppProfileSummary> {
    Ok(vault(&state)?.profile_summary(&input.app_id)?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoutInput {
    pub app_id: String,
    #[serde(default)]
    pub clear_oss: bool,
}

#[tauri::command]
pub fn cs_logout(state: State<'_, CloudSyncState>, input: LogoutInput) -> CmdResult<AppProfileSummary> {
    let v = vault(&state)?;
    if let Some(record) = v.clear_oauth(&input.app_id)? {
        let _ = revoke_refresh_token(&record);
    }
    if input.clear_oss {
        v.clear_oss(&input.app_id)?;
    }
    Ok(v.profile_summary(&input.app_id)?)
}

#[tauri::command]
pub fn cs_list_siblings(
    state: State<'_, CloudSyncState>,
    input: AppIdInput,
) -> CmdResult<Vec<SiblingSession>> {
    let summaries = vault(&state)?.sibling_summaries(&input.app_id)?;
    Ok(summaries
        .into_iter()
        .map(|s| SiblingSession {
            app_id: s.app_id,
            uid: s.uid,
            login_name: s.login_name,
            name: s.name,
            region: s.region,
        })
        .collect())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdoptInput {
    pub from_app_id: String,
    pub to_app_id: String,
    #[serde(default)]
    pub copy_oss: bool,
}

#[tauri::command]
pub fn cs_adopt_session(
    state: State<'_, CloudSyncState>,
    input: AdoptInput,
) -> CmdResult<AppProfileSummary> {
    Ok(vault(&state)?.adopt_session(&input.from_app_id, &input.to_app_id, input.copy_oss)?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureOssInput {
    pub app_id: String,
    pub config: OssConfigInput,
}

#[tauri::command]
pub fn cs_configure_oss(
    state: State<'_, CloudSyncState>,
    input: ConfigureOssInput,
) -> CmdResult<AppProfileSummary> {
    let oss = OssRecord {
        endpoint: input.config.endpoint.trim().to_string(),
        bucket: input.config.bucket.trim().to_string(),
        access_key_id: input.config.access_key_id.trim().to_string(),
        access_key_secret: input.config.access_key_secret.trim().to_string(),
        prefix: input.config.prefix.trim().to_string(),
    };
    if oss.endpoint.is_empty() || oss.bucket.is_empty() || oss.access_key_id.is_empty() {
        return Err(crate::error::Error::msg(
            "endpoint, bucket, and accessKeyId are required",
        )
        .into());
    }
    if oss.access_key_secret.is_empty() {
        // Allow keeping existing secret when UI sends blank (update other fields).
        let v = vault(&state)?;
        let mut merged = oss;
        if let Some(existing) = v.get_oss(&input.app_id)? {
            merged.access_key_secret = existing.access_key_secret;
        } else {
            return Err(crate::error::Error::msg("accessKeySecret is required").into());
        }
        v.set_oss(&input.app_id, merged)?;
        return Ok(v.profile_summary(&input.app_id)?);
    }
    let v = vault(&state)?;
    v.set_oss(&input.app_id, oss)?;
    Ok(v.profile_summary(&input.app_id)?)
}

fn require_oss(state: &CloudSyncState, app_id: &str) -> CmdResult<OssClient> {
    let record = vault(state)?
        .get_oss(app_id)?
        .ok_or_else(|| "OSS is not configured".to_string())?;
    OssClient::new(record).map_err(Into::into)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OssListInput {
    pub app_id: String,
    pub prefix: Option<String>,
    pub marker: Option<String>,
    pub max_keys: Option<u32>,
}

#[tauri::command]
pub fn cs_oss_list(
    state: State<'_, CloudSyncState>,
    input: OssListInput,
) -> CmdResult<Vec<OssObjectSummary>> {
    Ok(require_oss(&state, &input.app_id)?.list_objects(
        input.prefix.as_deref(),
        input.marker.as_deref(),
        input.max_keys,
    )?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OssKeyInput {
    pub app_id: String,
    pub key: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OssGetResult {
    pub key: String,
    pub base64: String,
}

#[tauri::command]
pub fn cs_oss_get(state: State<'_, CloudSyncState>, input: OssKeyInput) -> CmdResult<OssGetResult> {
    let bytes = require_oss(&state, &input.app_id)?.get_object(&input.key)?;
    Ok(OssGetResult {
        key: input.key,
        base64: B64.encode(bytes),
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OssPutInput {
    pub app_id: String,
    pub key: String,
    pub base64: String,
    pub content_type: Option<String>,
}

#[tauri::command]
pub fn cs_oss_put(state: State<'_, CloudSyncState>, input: OssPutInput) -> CmdResult<()> {
    let bytes = B64
        .decode(input.base64.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(require_oss(&state, &input.app_id)?.put_object(
        &input.key,
        &bytes,
        input.content_type.as_deref(),
    )?)
}

#[tauri::command]
pub fn cs_oss_delete(state: State<'_, CloudSyncState>, input: OssKeyInput) -> CmdResult<()> {
    Ok(require_oss(&state, &input.app_id)?.delete_object(&input.key)?)
}

#[tauri::command]
pub fn cs_oss_head(state: State<'_, CloudSyncState>, input: OssKeyInput) -> CmdResult<OssObjectMeta> {
    Ok(require_oss(&state, &input.app_id)?.head_object(&input.key)?)
}

#[tauri::command]
pub fn cs_open_url(url: String) -> CmdResult<()> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err(crate::error::Error::msg("only http(s) URLs may be opened").into());
    }
    open::that(trimmed).map_err(|e| e.to_string())
}

/// Open Aliyun login inside an app webview (avoids Arc/Chrome blank SPA shells).
/// Intercepts custom-scheme callback and emits [`OAUTH_CALLBACK_EVENT`].
#[tauri::command]
pub fn cs_open_oauth_login(app: AppHandle, url: String) -> CmdResult<()> {
    let trimmed = url.trim().to_string();
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("only http(s) login URLs are allowed".into());
    }
    let external: url::Url = trimmed
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    if let Some(existing) = app.get_webview_window(OAUTH_WINDOW_LABEL) {
        let _ = existing.destroy();
    }

    let app_nav = app.clone();
    WebviewWindowBuilder::new(&app, OAUTH_WINDOW_LABEL, WebviewUrl::External(external))
        .title("阿里云登录")
        .inner_size(520.0, 780.0)
        .resizable(true)
        .center()
        .on_navigation(move |nav_url| {
            if !is_oauth_callback_url(nav_url) {
                return true;
            }
            let callback = nav_url.as_str().to_string();
            let _ = app_nav.emit(OAUTH_CALLBACK_EVENT, callback);
            if let Some(win) = app_nav.get_webview_window(OAUTH_WINDOW_LABEL) {
                let _ = win.close();
            }
            false
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn is_oauth_callback_url(url: &url::Url) -> bool {
    let has_code = url.query_pairs().any(|(k, _)| k == "code");
    let has_state = url.query_pairs().any(|(k, _)| k == "state");
    if !has_code || !has_state {
        return false;
    }
    // Custom app scheme (vellum://...) or explicit oauth/callback path.
    let scheme = url.scheme();
    if scheme != "http" && scheme != "https" {
        return true;
    }
    url.path().contains("oauth/callback")
}

/// Ensure access token is fresh when within 120s of expiry.
#[tauri::command]
pub fn cs_ensure_access_token(
    state: State<'_, CloudSyncState>,
    input: AppIdInput,
) -> CmdResult<SessionSummary> {
    let v = vault(&state)?;
    let Some(record) = v.get_oauth(&input.app_id)? else {
        return Ok(session_from_record(None));
    };
    if record.expires_at > now_secs() + 120 {
        return Ok(session_from_record(Some(&record)));
    }
    let refreshed = refresh_access_token(&record)?;
    v.set_oauth(&input.app_id, refreshed.clone())?;
    Ok(session_from_record(Some(&refreshed)))
}
