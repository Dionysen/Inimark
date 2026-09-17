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
    sync_with_library, GitSyncState, OAUTH_ERROR_EVENT, OAUTH_SESSION_EVENT, OAUTH_WINDOW_LABEL,
};
pub use error::{Error, Result};
pub use oauth_local::LOCAL_GIT_OAUTH_REDIRECT_URI;
pub use sync::SyncResult;
pub use vault::{GitProvider, SessionSummary};
