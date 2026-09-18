//! GitHub / Gitee OAuth, encrypted vault, and PWB backup sync.
//!
//! Completely separate from `dionysen-cloud-sync` (Aliyun). Vault lives under
//! `com.dionysen.git-sync`.

pub mod commands;
mod error;
mod oauth;
mod oauth_local;
mod provider;
mod sync;
mod vault;

pub use commands::{
    download_backup_for_overwrite, emit_status, merge_restore_with_library, push_with_library,
    GitSyncState, OAUTH_ERROR_EVENT, OAUTH_SESSION_EVENT, OAUTH_WINDOW_LABEL,
};
pub use error::{Error, Result};
pub use oauth_local::LOCAL_GIT_OAUTH_REDIRECT_URI;
pub use provider::DEFAULT_REPO_NAME;
pub use sync::{
    push_backup, BackupMeta, PushResult, RestoreResult, SyncStatusPayload, STATUS_EVENT,
};
pub use vault::{GitProvider, SessionSummary, Vault};
