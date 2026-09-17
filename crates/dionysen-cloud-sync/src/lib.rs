//! Shared Aliyun OAuth, encrypted credential vault, and OSS object API.

pub mod commands;
mod error;
mod oauth;
mod oss;
mod vault;

pub use commands::{
    CloudSyncState, OAUTH_CALLBACK_EVENT, OAUTH_WINDOW_LABEL,
};
pub use error::{Error, Result};
pub use oauth::{OauthRegion, SessionSummary, SiblingSession};
pub use oss::{OssConfigPublic, OssObjectMeta, OssObjectSummary};
pub use vault::{AppProfileSummary, OssConfigInput};
