//! Localhost redirect URI for in-app OAuth webview (must be registered in Aliyun console).

/// Exact redirect URI to register alongside `vellum://oauth/callback`.
pub const LOCAL_OAUTH_REDIRECT_URI: &str = "http://127.0.0.1:39246/oauth/callback";
