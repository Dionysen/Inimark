//! Tauri commands for GitHub/Gitee OAuth and PWB sync.

use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::error::Error;
use crate::oauth::{authorize_url, exchange_code};
use crate::provider::list_backup_files;
use crate::sync::{after_login_bind_repo, ensure_repo_for_app, sync_open_library, SyncResult};
use crate::vault::{now_secs, GitProvider, PendingAuth, SessionSummary, Vault};

type CmdResult<T> = std::result::Result<T, String>;

pub const OAUTH_WINDOW_LABEL: &str = "git-oauth-login";
pub const OAUTH_SESSION_EVENT: &str = "git-sync-session-changed";
pub const OAUTH_ERROR_EVENT: &str = "git-sync-oauth-error";

static LAST_OAUTH_CALLBACK: Mutex<Option<String>> = Mutex::new(None);

pub struct GitSyncState {
    vault: Mutex<Vault>,
}

impl GitSyncState {
    pub fn new() -> Result<Self, Error> {
        Ok(Self {
            vault: Mutex::new(Vault::open_default()?),
        })
    }

    pub fn vault(&self) -> CmdResult<std::sync::MutexGuard<'_, Vault>> {
        self.vault
            .lock()
            .map_err(|_| "vault lock poisoned".to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginOauthInput {
    pub app_id: String,
    pub provider: String,
    pub client_id: String,
    #[serde(default)]
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    pub code_verifier: String,
    pub code_challenge: String,
    pub state: String,
    #[serde(default = "default_scope")]
    pub scope: String,
}

fn default_scope() -> String {
    "repo".into()
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginOauthResult {
    pub authorize_url: String,
}

#[tauri::command]
pub fn gs_begin_oauth(
    state: State<'_, GitSyncState>,
    input: BeginOauthInput,
) -> CmdResult<BeginOauthResult> {
    if input.client_id.trim().is_empty() {
        return Err("OAuth client_id is not configured".into());
    }
    let provider = GitProvider::parse(&input.provider).map_err(|e| e.to_string())?;
    let pending = PendingAuth {
        app_id: input.app_id,
        provider,
        client_id: input.client_id.clone(),
        client_secret: input.client_secret.clone(),
        redirect_uri: input.redirect_uri.clone(),
        code_verifier: input.code_verifier,
        state: input.state.clone(),
        created_at: now_secs(),
    };
    state.vault()?.begin_oauth(pending).map_err(|e| e.to_string())?;
    let url = authorize_url(
        provider,
        &input.client_id,
        &input.redirect_uri,
        &input.state,
        &input.code_challenge,
        &input.scope,
    );
    Ok(BeginOauthResult { authorize_url: url })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteOauthInput {
    pub code: String,
    pub state: String,
}

#[tauri::command]
pub fn gs_complete_oauth(
    state: State<'_, GitSyncState>,
    input: CompleteOauthInput,
) -> CmdResult<SessionSummary> {
    complete_oauth_exchange(&state, &input.code, &input.state)
}

fn complete_oauth_exchange(
    state: &GitSyncState,
    code: &str,
    oauth_state: &str,
) -> CmdResult<SessionSummary> {
    let pending = {
        let v = state.vault()?;
        v.take_pending()?
            .ok_or_else(|| "no pending oauth".to_string())?
    };
    if pending.state != oauth_state {
        let _ = state.vault()?.restore_pending(pending);
        return Err("state mismatch".into());
    }
    if now_secs() - pending.created_at > 600 {
        return Err("pending oauth expired".into());
    }
    let app_id = pending.app_id.clone();
    let record = match exchange_code(
        pending.provider,
        &pending.client_id,
        pending.client_secret.as_deref(),
        &pending.redirect_uri,
        code,
        &pending.code_verifier,
    ) {
        Ok(r) => r,
        Err(err) => {
            let _ = state.vault()?.restore_pending(pending);
            return Err(err.to_string());
        }
    };
    let repo = after_login_bind_repo(&record).map_err(|e| e.to_string())?;
    let v = state.vault()?;
    v.set_oauth(&app_id, record).map_err(|e| e.to_string())?;
    v.set_repo(&app_id, repo).map_err(|e| e.to_string())?;
    v.session_summary(&app_id).map_err(|e| e.to_string())
}

fn parse_callback_code_state(callback_url: &str) -> Option<(String, String)> {
    let parsed = url::Url::parse(callback_url).ok().or_else(|| {
        let q = callback_url.find('?')?;
        let mut base = url::Url::parse("vellum://git-oauth/callback").ok()?;
        base.set_query(Some(&callback_url[q + 1..]));
        Some(base)
    })?;
    let mut code = None;
    let mut state = None;
    for (k, v) in parsed.query_pairs() {
        if k == "code" {
            code = Some(v.into_owned());
        } else if k == "state" {
            state = Some(v.into_owned());
        }
    }
    Some((code?, state?))
}

fn handle_oauth_callback_url(app: &AppHandle, callback_url: &str) {
    {
        let mut last = LAST_OAUTH_CALLBACK
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if last.as_deref() == Some(callback_url) {
            return;
        }
        *last = Some(callback_url.to_string());
    }
    let Some((code, oauth_state)) = parse_callback_code_state(callback_url) else {
        let _ = app.emit(
            OAUTH_ERROR_EVENT,
            format!("invalid oauth callback: {callback_url}"),
        );
        return;
    };
    let result = {
        let state = app.state::<GitSyncState>();
        complete_oauth_exchange(&state, &code, &oauth_state)
    };
    match result {
        Ok(session) => {
            let _ = app.emit(OAUTH_SESSION_EVENT, session);
        }
        Err(err) => {
            if err != "no pending oauth" {
                let _ = app.emit(OAUTH_ERROR_EVENT, err);
            }
        }
    }
    if let Some(win) = app.get_webview_window(OAUTH_WINDOW_LABEL) {
        let _ = win.destroy();
    }
}

fn is_oauth_callback_url(url: &url::Url) -> bool {
    let has_code = url.query_pairs().any(|(k, _)| k == "code");
    let has_state = url.query_pairs().any(|(k, _)| k == "state");
    if !has_code || !has_state {
        return false;
    }
    let scheme = url.scheme();
    if scheme != "http" && scheme != "https" {
        return url.path().contains("git-oauth");
    }
    if matches!(url.host_str(), Some("127.0.0.1") | Some("localhost"))
        && url.path().contains("git-oauth")
    {
        return true;
    }
    url.as_str().contains("git-oauth/callback")
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppIdInput {
    pub app_id: String,
}

#[tauri::command]
pub fn gs_get_session(
    state: State<'_, GitSyncState>,
    input: AppIdInput,
) -> CmdResult<SessionSummary> {
    state
        .vault()?
        .session_summary(&input.app_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn gs_logout(state: State<'_, GitSyncState>, input: AppIdInput) -> CmdResult<SessionSummary> {
    let v = state.vault()?;
    let _ = v.clear_oauth(&input.app_id)?;
    v.session_summary(&input.app_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn gs_open_url(url: String) -> CmdResult<()> {
    open::that(url.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn gs_open_oauth_login(app: AppHandle, url: String) -> CmdResult<()> {
    let trimmed = url.trim().to_string();
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("only http(s) login URLs are allowed".into());
    }
    let external: url::Url = trimmed
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    if let Some(existing) = app.get_webview_window(OAUTH_WINDOW_LABEL) {
        {
            let mut last = LAST_OAUTH_CALLBACK
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            *last = None;
        }
        existing.navigate(external).map_err(|e| e.to_string())?;
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    {
        let mut last = LAST_OAUTH_CALLBACK
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *last = None;
    }

    let app_nav = app.clone();
    let app_load = app.clone();
    WebviewWindowBuilder::new(&app, OAUTH_WINDOW_LABEL, WebviewUrl::External(external))
        .title("Git login")
        .inner_size(520.0, 780.0)
        .resizable(true)
        .center()
        .on_navigation(move |nav_url| {
            if !is_oauth_callback_url(nav_url) {
                return true;
            }
            handle_oauth_callback_url(&app_nav, nav_url.as_str());
            false
        })
        .on_page_load(move |_window, payload| {
            let url = payload.url();
            if is_oauth_callback_url(url) {
                handle_oauth_callback_url(&app_load, url.as_str());
            }
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn gs_ensure_repo(
    state: State<'_, GitSyncState>,
    input: AppIdInput,
) -> CmdResult<SessionSummary> {
    let v = state.vault()?;
    ensure_repo_for_app(&v, &input.app_id).map_err(|e| e.to_string())?;
    v.session_summary(&input.app_id).map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncNowInput {
    pub app_id: String,
    pub library_root: String,
}

/// Sync using a library path. Prefer Vellum `pw_git_sync_now` when a library is already open.
#[tauri::command]
pub fn gs_sync_now(
    state: State<'_, GitSyncState>,
    input: SyncNowInput,
) -> CmdResult<SyncResult> {
    let lib = purewriter_store::Library::open(&input.library_root).map_err(|e| e.to_string())?;
    let v = state.vault()?;
    sync_open_library(&v, &input.app_id, &lib).map_err(|e| e.to_string())
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBackupInfo {
    pub path: String,
    pub size: Option<u64>,
}

#[tauri::command]
pub fn gs_list_remote_backups(
    state: State<'_, GitSyncState>,
    input: AppIdInput,
) -> CmdResult<Vec<RemoteBackupInfo>> {
    let v = state.vault()?;
    let oauth = v
        .get_oauth(&input.app_id)?
        .ok_or_else(|| "not logged in".to_string())?;
    let repo = v
        .get_repo(&input.app_id)?
        .ok_or_else(|| "repo not bound".to_string())?;
    let files = list_backup_files(&oauth, &repo).map_err(|e| e.to_string())?;
    Ok(files
        .into_iter()
        .map(|f| RemoteBackupInfo {
            path: f.path,
            size: f.size,
        })
        .collect())
}

/// Public helper for Vellum to sync with an already-open [`Library`].
pub fn sync_with_library(
    state: &GitSyncState,
    app_id: &str,
    lib: &purewriter_store::Library,
) -> CmdResult<SyncResult> {
    let v = state.vault()?;
    sync_open_library(&v, app_id, lib).map_err(|e| e.to_string())
}
