//! Shared Aliyun OAuth, encrypted credential vault, and OSS object API.

pub mod commands;
mod error;
mod oauth;
mod oauth_local;
mod oss;
mod vault;

pub use commands::{
    CloudSyncState, OAUTH_CALLBACK_EVENT, OAUTH_ERROR_EVENT, OAUTH_SESSION_EVENT,
    OAUTH_WINDOW_LABEL,
};
pub use error::{Error, Result};
pub use oauth::{OauthRegion, SessionSummary, SiblingSession};
pub use oauth_local::LOCAL_OAUTH_REDIRECT_URI;
pub use oss::{OssConfigPublic, OssObjectMeta, OssObjectSummary};
pub use vault::{AppProfileSummary, OssConfigInput};
