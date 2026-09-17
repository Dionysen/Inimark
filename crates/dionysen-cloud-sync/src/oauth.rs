//! Aliyun OAuth 2.0 (authorization code + PKCE) helpers.

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{Error, Result};
use crate::vault::{now_secs, OauthRecord};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OauthRegion {
    Cn,
    Intl,
}

impl OauthRegion {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Cn => "cn",
            Self::Intl => "intl",
        }
    }

    pub fn authorize_url(self) -> &'static str {
        match self {
            Self::Cn => "https://signin.aliyun.com/oauth2/v1/auth",
            Self::Intl => "https://signin.alibabacloud.com/oauth2/v1/auth",
        }
    }

    pub fn token_url(self) -> &'static str {
        match self {
            Self::Cn => "https://oauth.aliyun.com/v1/token",
            Self::Intl => "https://oauth.alibabacloud.com/v1/token",
        }
    }

    pub fn revoke_url(self) -> &'static str {
        match self {
            Self::Cn => "https://oauth.aliyun.com/v1/revoke",
            Self::Intl => "https://oauth.alibabacloud.com/v1/revoke",
        }
    }

    pub fn userinfo_url(self) -> &'static str {
        match self {
            Self::Cn => "https://oauth.aliyun.com/v1/userinfo",
            Self::Intl => "https://oauth.alibabacloud.com/v1/userinfo",
        }
    }

    /// Main (root) account login page — preferred over RAM-user `signin.../login.htm`.
    pub fn account_login_base(self) -> &'static str {
        match self {
            Self::Cn => "https://account.aliyun.com/login/login.htm",
            Self::Intl => "https://account.alibabacloud.com/login/login.htm",
        }
    }
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    /// Aliyun may return `expires_in` as a number or a string (`"3599"`).
    #[serde(default, deserialize_with = "deserialize_expires_in")]
    expires_in: Option<i64>,
    refresh_token: Option<String>,
    id_token: Option<String>,
}

fn deserialize_expires_in<'de, D>(deserializer: D) -> std::result::Result<Option<i64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<Value>::deserialize(deserializer)?;
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Number(n)) => n
            .as_i64()
            .or_else(|| n.as_u64().and_then(|u| i64::try_from(u).ok()))
            .ok_or_else(|| serde::de::Error::custom("expires_in number out of range"))
            .map(Some),
        Some(Value::String(s)) => {
            let s = s.trim();
            if s.is_empty() {
                return Ok(None);
            }
            s.parse::<i64>()
                .map(Some)
                .map_err(|_| serde::de::Error::custom(format!("invalid expires_in: {s}")))
        }
        Some(other) => Err(serde::de::Error::custom(format!(
            "expires_in must be number or string, got {other}"
        ))),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub logged_in: bool,
    pub uid: Option<String>,
    pub aid: Option<String>,
    pub login_name: Option<String>,
    pub name: Option<String>,
    pub region: Option<String>,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiblingSession {
    pub app_id: String,
    pub uid: Option<String>,
    pub login_name: Option<String>,
    pub name: Option<String>,
    pub region: Option<String>,
}

pub fn build_authorize_url(
    region: OauthRegion,
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
    scope: &str,
) -> String {
    format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
        region.authorize_url(),
        urlencoding::encode(client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(scope),
        urlencoding::encode(state),
        urlencoding::encode(code_challenge),
    )
}

/// Aliyun's `/oauth2/v1/auth` replies with an empty-bodied 302 to RAM `login.htm`.
/// Rewrite that to the main-account login page (`account.*.com`) so users land on
/// 主账号登录 instead of RAM 用户登录. Some browsers also blank on the empty 302.
pub fn resolve_browser_login_url(authorize_url: &str, region: OauthRegion) -> Result<String> {
    let client = reqwest::blocking::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| Error::Http(e.to_string()))?;
    let resp = client
        .get(authorize_url)
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 DionysenCloudSync/0.1",
        )
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    if resp.status().is_redirection() {
        if let Some(loc) = resp.headers().get(reqwest::header::LOCATION) {
            let loc = loc
                .to_str()
                .map_err(|e| Error::Http(e.to_string()))?
                .to_string();
            if loc.starts_with("https://") || loc.starts_with("http://") {
                return Ok(prefer_main_account_login_url(&loc, region).unwrap_or(loc));
            }
        }
    }
    // Non-redirect (e.g. JSON error) — fall back so the browser still shows the message.
    Ok(authorize_url.to_string())
}

/// Convert `signin.../login.htm?callback=<oauth>` → `account.../login.htm?oauth_callback=<oauth>`.
pub fn prefer_main_account_login_url(signin_login_url: &str, region: OauthRegion) -> Option<String> {
    let parsed = url::Url::parse(signin_login_url).ok()?;
    let host = parsed.host_str().unwrap_or("");
    // Already on account login — keep as-is.
    if host.starts_with("account.") {
        return Some(signin_login_url.to_string());
    }
    let callback = parsed
        .query_pairs()
        .find(|(k, _)| k == "callback")
        .map(|(_, v)| v.into_owned())?;
    let mut out = url::Url::parse(region.account_login_base()).ok()?;
    {
        let mut q = out.query_pairs_mut();
        q.append_pair("oauth_callback", &callback);
    }
    Some(out.to_string())
}

pub fn exchange_code(
    region: OauthRegion,
    client_id: &str,
    redirect_uri: &str,
    code: &str,
    code_verifier: &str,
) -> Result<OauthRecord> {
    let client = http_client()?;
    let body = [
        ("code", code),
        ("client_id", client_id),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
        ("code_verifier", code_verifier),
    ];
    let resp = client
        .post(region.token_url())
        .form(&body)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Oauth(format!("token exchange failed ({status}): {text}")));
    }
    let token: TokenResponse =
        serde_json::from_str(&text).map_err(|e| Error::Oauth(e.to_string()))?;
    let mut record = OauthRecord {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: now_secs() + token.expires_in.unwrap_or(3600),
        token_type: token.token_type,
        id_token: token.id_token,
        sub: None,
        uid: None,
        aid: None,
        login_name: None,
        name: None,
        region: region.as_str().to_string(),
        client_id: client_id.to_string(),
    };
    enrich_identity(region, &mut record)?;
    Ok(record)
}

pub fn refresh_access_token(record: &OauthRecord) -> Result<OauthRecord> {
    let refresh = record
        .refresh_token
        .as_deref()
        .ok_or_else(|| Error::Oauth("no refresh_token".into()))?;
    let region = crate::vault::parse_region(&record.region)?;
    let client = http_client()?;
    let body = [
        ("refresh_token", refresh),
        ("client_id", record.client_id.as_str()),
        ("grant_type", "refresh_token"),
    ];
    let resp = client
        .post(region.token_url())
        .form(&body)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Oauth(format!("refresh failed ({status}): {text}")));
    }
    let token: TokenResponse =
        serde_json::from_str(&text).map_err(|e| Error::Oauth(e.to_string()))?;
    let mut next = record.clone();
    next.access_token = token.access_token;
    next.expires_at = now_secs() + token.expires_in.unwrap_or(3600);
    next.token_type = token.token_type;
    // refresh response typically omits refresh_token / id_token
    enrich_identity(region, &mut next)?;
    Ok(next)
}

pub fn revoke_refresh_token(record: &OauthRecord) -> Result<()> {
    let Some(refresh) = record.refresh_token.as_deref() else {
        return Ok(());
    };
    let region = crate::vault::parse_region(&record.region)?;
    let client = http_client()?;
    let body = [("token", refresh), ("client_id", record.client_id.as_str())];
    let resp = client
        .post(region.revoke_url())
        .form(&body)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().unwrap_or_default();
        return Err(Error::Oauth(format!("revoke failed ({status}): {text}")));
    }
    Ok(())
}

fn enrich_identity(region: OauthRegion, record: &mut OauthRecord) -> Result<()> {
    if let Some(id_token) = record.id_token.clone() {
        if let Ok(claims) = decode_jwt_claims(&id_token) {
            apply_claims(record, &claims);
        }
    }
    // Prefer userinfo when available for profile fields.
    if let Ok(info) = fetch_userinfo(region, &record.access_token) {
        apply_claims(record, &info);
    }
    Ok(())
}

fn fetch_userinfo(region: OauthRegion, access_token: &str) -> Result<Value> {
    let client = http_client()?;
    let resp = client
        .get(region.userinfo_url())
        .bearer_auth(access_token)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Oauth(format!("userinfo failed ({status}): {text}")));
    }
    serde_json::from_str(&text).map_err(|e| Error::Oauth(e.to_string()))
}

fn decode_jwt_claims(token: &str) -> Result<Value> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() < 2 {
        return Err(Error::Oauth("invalid id_token".into()));
    }
    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(parts[1].as_bytes())
        .or_else(|_| {
            base64::engine::general_purpose::URL_SAFE.decode(parts[1].as_bytes())
        })
        .map_err(|e| Error::Oauth(e.to_string()))?;
    serde_json::from_slice(&payload).map_err(|e| Error::Oauth(e.to_string()))
}

fn apply_claims(record: &mut OauthRecord, claims: &Value) {
    if let Some(v) = claims.get("sub").and_then(|v| v.as_str()) {
        record.sub = Some(v.to_string());
    }
    if let Some(v) = claims.get("uid").and_then(|v| v.as_str()) {
        record.uid = Some(v.to_string());
    } else if let Some(v) = claims.get("uid").and_then(|v| v.as_i64()) {
        record.uid = Some(v.to_string());
    }
    if let Some(v) = claims.get("aid").and_then(|v| v.as_str()) {
        record.aid = Some(v.to_string());
    } else if let Some(v) = claims.get("aid").and_then(|v| v.as_i64()) {
        record.aid = Some(v.to_string());
    }
    if let Some(v) = claims.get("login_name").and_then(|v| v.as_str()) {
        record.login_name = Some(v.to_string());
    }
    if let Some(v) = claims.get("name").and_then(|v| v.as_str()) {
        record.name = Some(v.to_string());
    } else if let Some(v) = claims.get("upn").and_then(|v| v.as_str()) {
        record.name = Some(v.to_string());
    }
}

fn http_client() -> Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| Error::Http(e.to_string()))
}

pub fn session_from_record(record: Option<&OauthRecord>) -> SessionSummary {
    match record {
        Some(r) => SessionSummary {
            logged_in: true,
            uid: r.uid.clone(),
            aid: r.aid.clone(),
            login_name: r.login_name.clone(),
            name: r.name.clone(),
            region: Some(r.region.clone()),
            expires_at: Some(r.expires_at),
        },
        None => SessionSummary {
            logged_in: false,
            uid: None,
            aid: None,
            login_name: None,
            name: None,
            region: None,
            expires_at: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorize_url_encodes_params() {
        let url = build_authorize_url(
            OauthRegion::Cn,
            "cid",
            "vellum://oauth/callback",
            "st",
            "challenge",
            "openid aliuid profile",
        );
        assert!(url.starts_with("https://signin.aliyun.com/oauth2/v1/auth?"));
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("redirect_uri=vellum%3A%2F%2Foauth%2Fcallback"));
    }

    #[test]
    fn prefer_main_account_rewrites_ram_login() {
        let ram = "https://signin.aliyun.com/login.htm?callback=https%3A%2F%2Fsignin.aliyun.com%2Foauth2%2Fv1%2Fauth%3Fauthorization_request%3Dabc";
        let main = prefer_main_account_login_url(ram, OauthRegion::Cn).unwrap();
        assert!(main.starts_with("https://account.aliyun.com/login/login.htm?"));
        assert!(main.contains("oauth_callback="));
        assert!(main.contains("authorization_request%3Dabc"));
    }

    #[test]
    fn resolve_login_url_follows_empty_302() {
        let url = build_authorize_url(
            OauthRegion::Cn,
            "4062933289650685453",
            "vellum://oauth/callback",
            "st",
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
            "openid aliuid profile",
        );
        let browser = resolve_browser_login_url(&url, OauthRegion::Cn).expect("resolve");
        assert!(
            browser.contains("account.aliyun.com/login/login.htm")
                || browser.contains("login.htm")
                || browser == url,
            "unexpected browser url: {browser}"
        );
    }

    #[test]
    fn decode_jwt_payload() {
        // header.payload.sig — payload is {"sub":"abc","uid":"1"}
        let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(br#"{"sub":"abc","uid":"1","login_name":"alice"}"#);
        let token = format!("eyJhbGciOiJub25lIn0.{payload}.x");
        let claims = decode_jwt_claims(&token).unwrap();
        assert_eq!(claims["sub"], "abc");
        assert_eq!(claims["uid"], "1");
    }

    #[test]
    fn token_response_accepts_string_expires_in() {
        let json = r#"{
            "access_token":"at",
            "token_type":"Bearer",
            "expires_in":"3599",
            "refresh_token":"rt"
        }"#;
        let token: TokenResponse = serde_json::from_str(json).unwrap();
        assert_eq!(token.expires_in, Some(3599));
    }

    #[test]
    fn token_response_accepts_numeric_expires_in() {
        let json = r#"{
            "access_token":"at",
            "token_type":"Bearer",
            "expires_in":3600
        }"#;
        let token: TokenResponse = serde_json::from_str(json).unwrap();
        assert_eq!(token.expires_in, Some(3600));
    }
}
