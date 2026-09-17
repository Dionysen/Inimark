//! OAuth helpers for GitHub and Gitee (authorization code + PKCE).

use serde::Deserialize;
use serde_json::Value;

use crate::error::{Error, Result};
use crate::vault::{now_secs, GitProvider, OauthRecord};

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    token_type: Option<String>,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default, deserialize_with = "deserialize_expires_in")]
    expires_in: Option<i64>,
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
            .ok_or_else(|| serde::de::Error::custom("expires_in out of range"))
            .map(Some),
        Some(Value::String(s)) => {
            let s = s.trim();
            if s.is_empty() {
                Ok(None)
            } else {
                s.parse::<i64>()
                    .map(Some)
                    .map_err(|_| serde::de::Error::custom(format!("invalid expires_in: {s}")))
            }
        }
        Some(other) => Err(serde::de::Error::custom(format!(
            "expires_in must be number or string, got {other}"
        ))),
    }
}

pub fn authorize_url(
    provider: GitProvider,
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
    scope: &str,
) -> String {
    match provider {
        GitProvider::Github => format!(
            "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            urlencoding::encode(client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(scope),
            urlencoding::encode(state),
            urlencoding::encode(code_challenge),
        ),
        GitProvider::Gitee => format!(
            "https://gitee.com/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            urlencoding::encode(client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(scope),
            urlencoding::encode(state),
            urlencoding::encode(code_challenge),
        ),
    }
}

pub fn exchange_code(
    provider: GitProvider,
    client_id: &str,
    client_secret: Option<&str>,
    redirect_uri: &str,
    code: &str,
    code_verifier: &str,
) -> Result<OauthRecord> {
    let client = http_client()?;
    let token = match provider {
        GitProvider::Github => {
            let mut form = vec![
                ("client_id", client_id.to_string()),
                ("code", code.to_string()),
                ("redirect_uri", redirect_uri.to_string()),
                ("code_verifier", code_verifier.to_string()),
                ("grant_type", "authorization_code".into()),
            ];
            if let Some(secret) = client_secret.filter(|s| !s.is_empty()) {
                form.push(("client_secret", secret.to_string()));
            }
            let resp = client
                .post("https://github.com/login/oauth/access_token")
                .header(reqwest::header::ACCEPT, "application/json")
                .form(&form)
                .send()
                .map_err(|e| Error::Http(e.to_string()))?;
            parse_token_response(resp)?
        }
        GitProvider::Gitee => {
            let secret = client_secret
                .filter(|s| !s.is_empty())
                .ok_or_else(|| Error::Oauth("gitee requires client_secret".into()))?;
            let form = [
                ("grant_type", "authorization_code"),
                ("code", code),
                ("client_id", client_id),
                ("redirect_uri", redirect_uri),
                ("client_secret", secret),
                ("code_verifier", code_verifier),
            ];
            let resp = client
                .post("https://gitee.com/oauth/token")
                .form(&form)
                .send()
                .map_err(|e| Error::Http(e.to_string()))?;
            parse_token_response(resp)?
        }
    };

    let mut record = OauthRecord {
        provider,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_in.map(|s| now_secs() + s),
        token_type: token.token_type.unwrap_or_else(|| "bearer".into()),
        login: String::new(),
        name: None,
        avatar_url: None,
        client_id: client_id.to_string(),
        client_secret: client_secret.map(|s| s.to_string()),
    };
    enrich_user(provider, &mut record)?;
    Ok(record)
}

fn parse_token_response(resp: reqwest::blocking::Response) -> Result<TokenResponse> {
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Oauth(format!("token exchange failed ({status}): {text}")));
    }
    // GitHub may return error in 200 JSON body.
    if let Ok(v) = serde_json::from_str::<Value>(&text) {
        if let Some(err) = v.get("error").and_then(|e| e.as_str()) {
            let desc = v
                .get("error_description")
                .and_then(|d| d.as_str())
                .unwrap_or("");
            return Err(Error::Oauth(format!("{err}: {desc}")));
        }
    }
    serde_json::from_str(&text).map_err(|e| Error::Oauth(e.to_string()))
}

fn enrich_user(provider: GitProvider, record: &mut OauthRecord) -> Result<()> {
    let client = http_client()?;
    let (url, auth_header) = match provider {
        GitProvider::Github => (
            "https://api.github.com/user",
            format!("Bearer {}", record.access_token),
        ),
        GitProvider::Gitee => (
            "https://gitee.com/api/v5/user",
            format!("token {}", record.access_token),
        ),
    };
    let mut req = client.get(url).header(reqwest::header::USER_AGENT, "Vellum-GitSync/0.1");
    req = match provider {
        GitProvider::Github => req.header(reqwest::header::AUTHORIZATION, auth_header),
        GitProvider::Gitee => req.query(&[("access_token", record.access_token.as_str())]),
    };
    let resp = req.send().map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Oauth(format!("userinfo failed ({status}): {text}")));
    }
    let v: Value = serde_json::from_str(&text).map_err(|e| Error::Oauth(e.to_string()))?;
    record.login = v
        .get("login")
        .and_then(|x| x.as_str())
        .unwrap_or("unknown")
        .to_string();
    record.name = v
        .get("name")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());
    record.avatar_url = v
        .get("avatar_url")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    Ok(())
}

fn http_client() -> Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| Error::Http(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn github_authorize_contains_pkce() {
        let url = authorize_url(
            GitProvider::Github,
            "cid",
            "vellum://git-oauth/callback",
            "st",
            "challenge",
            "repo",
        );
        assert!(url.contains("code_challenge=challenge"));
        assert!(url.contains("github.com/login/oauth/authorize"));
    }

    #[test]
    fn token_accepts_string_expires() {
        let json = r#"{"access_token":"a","token_type":"bearer","expires_in":"3600"}"#;
        let t: TokenResponse = serde_json::from_str(json).unwrap();
        assert_eq!(t.expires_in, Some(3600));
    }
}
