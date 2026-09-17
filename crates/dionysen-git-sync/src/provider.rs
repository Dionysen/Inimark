//! GitHub / Gitee REST helpers for private repo + file contents.

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{Error, Result};
use crate::vault::{GitProvider, OauthRecord, RepoBinding};

pub const DEFAULT_REPO_NAME: &str = "vellum-pwb-sync";
pub const BACKUPS_DIR: &str = "backups";
pub const MAX_REMOTE_BACKUPS: usize = 50;

#[derive(Debug, Clone)]
pub struct RemoteFile {
    pub path: String,
    pub sha: Option<String>,
    pub size: Option<u64>,
    pub download_url: Option<String>,
}

fn http_client() -> Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("Vellum-GitSync/0.1")
        .build()
        .map_err(|e| Error::Http(e.to_string()))
}

fn auth_headers(oauth: &OauthRecord) -> Result<reqwest::header::HeaderMap> {
    let mut headers = reqwest::header::HeaderMap::new();
    match oauth.provider {
        GitProvider::Github => {
            headers.insert(
                reqwest::header::AUTHORIZATION,
                format!("Bearer {}", oauth.access_token)
                    .parse()
                    .map_err(|e: reqwest::header::InvalidHeaderValue| Error::Http(e.to_string()))?,
            );
            headers.insert(
                reqwest::header::ACCEPT,
                "application/vnd.github+json"
                    .parse()
                    .map_err(|e: reqwest::header::InvalidHeaderValue| Error::Http(e.to_string()))?,
            );
        }
        GitProvider::Gitee => {
            // Gitee prefers access_token query; still set Accept.
            headers.insert(
                reqwest::header::ACCEPT,
                "application/json"
                    .parse()
                    .map_err(|e: reqwest::header::InvalidHeaderValue| Error::Http(e.to_string()))?,
            );
        }
    }
    Ok(headers)
}

fn gitee_token_q(oauth: &OauthRecord) -> Vec<(&str, String)> {
    vec![("access_token", oauth.access_token.clone())]
}

/// Ensure a private repo with the given name exists; create if missing.
pub fn ensure_private_repo(oauth: &OauthRecord, repo_name: &str) -> Result<RepoBinding> {
    let name = repo_name.trim();
    if name.is_empty() {
        return Err(Error::msg("repo name is empty"));
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(Error::msg(
            "repo name may only contain letters, digits, '-', '_' and '.'",
        ));
    }
    match oauth.provider {
        GitProvider::Github => ensure_github_repo(oauth, name),
        GitProvider::Gitee => ensure_gitee_repo(oauth, name),
    }
}

fn ensure_github_repo(oauth: &OauthRecord, repo_name: &str) -> Result<RepoBinding> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let full = format!("{}/{}", oauth.login, repo_name);
    let get = client
        .get(format!("https://api.github.com/repos/{full}"))
        .headers(headers.clone())
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    if get.status().is_success() {
        return parse_github_repo(get.text().map_err(|e| Error::Http(e.to_string()))?);
    }
    if get.status().as_u16() != 404 {
        let status = get.status();
        let text = get.text().unwrap_or_default();
        return Err(Error::Http(format!("github get repo ({status}): {text}")));
    }
    let body = json!({
        "name": repo_name,
        "private": true,
        "auto_init": true,
        "description": "Vellum Pure Writer PWB backups (managed by app)"
    });
    let create = client
        .post("https://api.github.com/user/repos")
        .headers(headers)
        .json(&body)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = create.status();
    let text = create.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("github create repo ({status}): {text}")));
    }
    parse_github_repo(text)
}

fn parse_github_repo(text: String) -> Result<RepoBinding> {
    let v: Value = serde_json::from_str(&text)?;
    Ok(RepoBinding {
        full_name: v["full_name"].as_str().unwrap_or("").to_string(),
        owner: v["owner"]["login"].as_str().unwrap_or("").to_string(),
        name: v["name"].as_str().unwrap_or(DEFAULT_REPO_NAME).to_string(),
        private: v["private"].as_bool().unwrap_or(true),
        html_url: v["html_url"].as_str().map(|s| s.to_string()),
    })
}

fn ensure_gitee_repo(oauth: &OauthRecord, repo_name: &str) -> Result<RepoBinding> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let full = format!("{}/{}", oauth.login, repo_name);
    let get = client
        .get(format!("https://gitee.com/api/v5/repos/{full}"))
        .headers(headers.clone())
        .query(&gitee_token_q(oauth))
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    if get.status().is_success() {
        return parse_gitee_repo(get.text().map_err(|e| Error::Http(e.to_string()))?);
    }
    if get.status().as_u16() != 404 {
        let status = get.status();
        let text = get.text().unwrap_or_default();
        return Err(Error::Http(format!("gitee get repo ({status}): {text}")));
    }
    let create = client
        .post("https://gitee.com/api/v5/user/repos")
        .headers(headers)
        .query(&gitee_token_q(oauth))
        .form(&[
            ("name", repo_name),
            ("private", "true"),
            ("auto_init", "true"),
            ("description", "Vellum Pure Writer PWB backups (managed by app)"),
        ])
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = create.status();
    let text = create.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("gitee create repo ({status}): {text}")));
    }
    parse_gitee_repo(text)
}

fn parse_gitee_repo(text: String) -> Result<RepoBinding> {
    let v: Value = serde_json::from_str(&text)?;
    let owner = v["owner"]["login"]
        .as_str()
        .or_else(|| v["namespace"]["path"].as_str())
        .unwrap_or("")
        .to_string();
    let name = v["name"].as_str().unwrap_or(DEFAULT_REPO_NAME).to_string();
    let full_name = v["full_name"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{owner}/{name}"));
    Ok(RepoBinding {
        full_name,
        owner,
        name,
        private: v["private"].as_bool().unwrap_or(true),
        html_url: v["html_url"].as_str().map(|s| s.to_string()),
    })
}

/// List files under `backups/` in the bound repo.
pub fn list_backup_files(oauth: &OauthRecord, repo: &RepoBinding) -> Result<Vec<RemoteFile>> {
    match oauth.provider {
        GitProvider::Github => list_github_dir(oauth, repo, BACKUPS_DIR),
        GitProvider::Gitee => list_gitee_dir(oauth, repo, BACKUPS_DIR),
    }
}

fn list_github_dir(oauth: &OauthRecord, repo: &RepoBinding, path: &str) -> Result<Vec<RemoteFile>> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        repo.full_name, path
    );
    let resp = client
        .get(&url)
        .headers(headers)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    if resp.status().as_u16() == 404 {
        return Ok(Vec::new());
    }
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("github list ({status}): {text}")));
    }
    let arr: Vec<Value> = serde_json::from_str(&text)?;
    Ok(arr
        .into_iter()
        .filter(|v| v["type"].as_str() == Some("file"))
        .filter(|v| {
            v["name"]
                .as_str()
                .map(|n| n.ends_with(".pwb"))
                .unwrap_or(false)
        })
        .map(|v| RemoteFile {
            path: v["path"].as_str().unwrap_or("").to_string(),
            sha: v["sha"].as_str().map(|s| s.to_string()),
            size: v["size"].as_u64(),
            download_url: v["download_url"].as_str().map(|s| s.to_string()),
        })
        .collect())
}

fn list_gitee_dir(oauth: &OauthRecord, repo: &RepoBinding, path: &str) -> Result<Vec<RemoteFile>> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let url = format!(
        "https://gitee.com/api/v5/repos/{}/contents/{}",
        repo.full_name, path
    );
    let resp = client
        .get(&url)
        .headers(headers)
        .query(&gitee_token_q(oauth))
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    if resp.status().as_u16() == 404 {
        return Ok(Vec::new());
    }
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("gitee list ({status}): {text}")));
    }
    let arr: Vec<Value> = serde_json::from_str(&text)?;
    Ok(arr
        .into_iter()
        .filter(|v| v["type"].as_str() == Some("file"))
        .filter(|v| {
            v["name"]
                .as_str()
                .map(|n| n.ends_with(".pwb"))
                .unwrap_or(false)
        })
        .map(|v| RemoteFile {
            path: v["path"].as_str().unwrap_or("").to_string(),
            sha: v["sha"].as_str().map(|s| s.to_string()),
            size: v["size"].as_u64(),
            download_url: v["download_url"]
                .as_str()
                .or_else(|| v["html_url"].as_str())
                .map(|s| s.to_string()),
        })
        .collect())
}

pub fn upload_backup(
    oauth: &OauthRecord,
    repo: &RepoBinding,
    path: &str,
    bytes: &[u8],
    message: &str,
) -> Result<()> {
    match oauth.provider {
        GitProvider::Github => put_github_file(oauth, repo, path, bytes, message, None),
        GitProvider::Gitee => put_gitee_file(oauth, repo, path, bytes, message, None),
    }
}

/// Create or update a text/binary file (e.g. manifest.json).
pub fn upsert_file(
    oauth: &OauthRecord,
    repo: &RepoBinding,
    path: &str,
    bytes: &[u8],
    message: &str,
) -> Result<()> {
    let existing = get_file_meta(oauth, repo, path)?;
    let sha = existing.as_ref().and_then(|f| f.sha.as_deref());
    match oauth.provider {
        GitProvider::Github => put_github_file(oauth, repo, path, bytes, message, sha),
        GitProvider::Gitee => put_gitee_file(oauth, repo, path, bytes, message, sha),
    }
}

pub fn get_file_meta(
    oauth: &OauthRecord,
    repo: &RepoBinding,
    path: &str,
) -> Result<Option<RemoteFile>> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let (url, with_token) = match oauth.provider {
        GitProvider::Github => (
            format!(
                "https://api.github.com/repos/{}/contents/{}",
                repo.full_name, path
            ),
            false,
        ),
        GitProvider::Gitee => (
            format!(
                "https://gitee.com/api/v5/repos/{}/contents/{}",
                repo.full_name, path
            ),
            true,
        ),
    };
    let mut req = client.get(&url).headers(headers);
    if with_token {
        req = req.query(&gitee_token_q(oauth));
    }
    let resp = req.send().map_err(|e| Error::Http(e.to_string()))?;
    if resp.status().as_u16() == 404 {
        return Ok(None);
    }
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("get file meta ({status}): {text}")));
    }
    let v: Value = serde_json::from_str(&text)?;
    Ok(Some(RemoteFile {
        path: v["path"].as_str().unwrap_or(path).to_string(),
        sha: v["sha"].as_str().map(|s| s.to_string()),
        size: v["size"].as_u64(),
        download_url: v["download_url"].as_str().map(|s| s.to_string()),
    }))
}

pub fn download_path(oauth: &OauthRecord, repo: &RepoBinding, path: &str) -> Result<Vec<u8>> {
    let meta = get_file_meta(oauth, repo, path)?
        .ok_or_else(|| Error::Sync(format!("file not found: {path}")))?;
    download_file(oauth, repo, &meta)
}

pub fn delete_backup(oauth: &OauthRecord, repo: &RepoBinding, file: &RemoteFile) -> Result<()> {
    let Some(sha) = file.sha.as_deref() else {
        return Err(Error::Sync(format!("missing sha for {}", file.path)));
    };
    match oauth.provider {
        GitProvider::Github => delete_github_file(oauth, repo, &file.path, sha),
        GitProvider::Gitee => delete_gitee_file(oauth, repo, &file.path, sha),
    }
}

fn put_github_file(
    oauth: &OauthRecord,
    repo: &RepoBinding,
    path: &str,
    bytes: &[u8],
    message: &str,
    sha: Option<&str>,
) -> Result<()> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        repo.full_name, path
    );
    let mut body = json!({
        "message": message,
        "content": B64.encode(bytes),
    });
    if let Some(sha) = sha {
        body["sha"] = json!(sha);
    }
    let resp = client
        .put(&url)
        .headers(headers)
        .json(&body)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("github put ({status}): {text}")));
    }
    Ok(())
}

fn put_gitee_file(
    oauth: &OauthRecord,
    repo: &RepoBinding,
    path: &str,
    bytes: &[u8],
    message: &str,
    sha: Option<&str>,
) -> Result<()> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let url = format!(
        "https://gitee.com/api/v5/repos/{}/contents/{}",
        repo.full_name, path
    );
    let mut form = vec![
        ("access_token", oauth.access_token.clone()),
        ("content", B64.encode(bytes)),
        ("message", message.to_string()),
    ];
    if let Some(sha) = sha {
        form.push(("sha", sha.to_string()));
    }
    let resp = if sha.is_some() {
        client.put(&url).headers(headers).form(&form)
    } else {
        client.post(&url).headers(headers).form(&form)
    }
    .send()
    .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("gitee put ({status}): {text}")));
    }
    Ok(())
}

fn delete_github_file(oauth: &OauthRecord, repo: &RepoBinding, path: &str, sha: &str) -> Result<()> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        repo.full_name, path
    );
    let body = json!({
        "message": format!("prune old PWB backup {path}"),
        "sha": sha,
    });
    let resp = client
        .delete(&url)
        .headers(headers)
        .json(&body)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(Error::Http(format!("github delete ({status}): {text}")));
    }
    Ok(())
}

fn delete_gitee_file(oauth: &OauthRecord, repo: &RepoBinding, path: &str, sha: &str) -> Result<()> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    let url = format!(
        "https://gitee.com/api/v5/repos/{}/contents/{}",
        repo.full_name, path
    );
    let resp = client
        .delete(&url)
        .headers(headers)
        .query(&gitee_token_q(oauth))
        .form(&[
            ("sha", sha),
            ("message", &format!("prune old PWB backup {path}")),
        ])
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(Error::Http(format!("gitee delete ({status}): {text}")));
    }
    Ok(())
}

pub fn download_file(oauth: &OauthRecord, repo: &RepoBinding, file: &RemoteFile) -> Result<Vec<u8>> {
    match oauth.provider {
        GitProvider::Github => download_github(oauth, repo, file),
        GitProvider::Gitee => download_gitee(oauth, repo, file),
    }
}

fn download_github(oauth: &OauthRecord, repo: &RepoBinding, file: &RemoteFile) -> Result<Vec<u8>> {
    let client = http_client()?;
    let headers = auth_headers(oauth)?;
    if let Some(url) = &file.download_url {
        let resp = client
            .get(url)
            .headers(headers)
            .send()
            .map_err(|e| Error::Http(e.to_string()))?;
        let status = resp.status();
        let bytes = resp.bytes().map_err(|e| Error::Http(e.to_string()))?;
        if !status.is_success() {
            return Err(Error::Http(format!("github download ({status})")));
        }
        return Ok(bytes.to_vec());
    }
    // Fallback: contents API returns base64
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        repo.full_name, file.path
    );
    let resp = client
        .get(&url)
        .headers(auth_headers(oauth)?)
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("github contents ({status}): {text}")));
    }
    #[derive(Deserialize)]
    struct ContentResp {
        content: String,
        encoding: String,
    }
    let parsed: ContentResp = serde_json::from_str(&text)?;
    if parsed.encoding != "base64" {
        return Err(Error::Sync(format!("unexpected encoding {}", parsed.encoding)));
    }
    let cleaned: String = parsed.content.chars().filter(|c| !c.is_whitespace()).collect();
    B64.decode(cleaned.as_bytes())
        .map_err(|e| Error::Sync(e.to_string()))
}

fn download_gitee(oauth: &OauthRecord, repo: &RepoBinding, file: &RemoteFile) -> Result<Vec<u8>> {
    let client = http_client()?;
    let url = format!(
        "https://gitee.com/api/v5/repos/{}/contents/{}",
        repo.full_name, file.path
    );
    let resp = client
        .get(&url)
        .headers(auth_headers(oauth)?)
        .query(&gitee_token_q(oauth))
        .send()
        .map_err(|e| Error::Http(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().map_err(|e| Error::Http(e.to_string()))?;
    if !status.is_success() {
        return Err(Error::Http(format!("gitee contents ({status}): {text}")));
    }
    let v: Value = serde_json::from_str(&text)?;
    let content = v["content"].as_str().unwrap_or("");
    let encoding = v["encoding"].as_str().unwrap_or("base64");
    if encoding != "base64" {
        return Err(Error::Sync(format!("unexpected encoding {encoding}")));
    }
    let cleaned: String = content.chars().filter(|c| !c.is_whitespace()).collect();
    B64.decode(cleaned.as_bytes())
        .map_err(|e| Error::Sync(e.to_string()))
}

/// Sort backups by path (timestamp prefix) ascending; prune oldest beyond max.
pub fn prune_plan(files: &[RemoteFile], keep: usize) -> Vec<&RemoteFile> {
    let mut sorted: Vec<&RemoteFile> = files.iter().collect();
    sorted.sort_by(|a, b| a.path.cmp(&b.path));
    if sorted.len() <= keep {
        return Vec::new();
    }
    let drop_count = sorted.len() - keep;
    sorted.into_iter().take(drop_count).collect()
}

pub fn backup_filename(device_id: &str) -> String {
    let ts = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    format!("{BACKUPS_DIR}/{ts}_{device_id}.pwb")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prune_keeps_newest() {
        let files = vec![
            RemoteFile {
                path: "backups/20260101T000000Z_a.pwb".into(),
                sha: Some("1".into()),
                size: None,
                download_url: None,
            },
            RemoteFile {
                path: "backups/20260301T000000Z_a.pwb".into(),
                sha: Some("2".into()),
                size: None,
                download_url: None,
            },
            RemoteFile {
                path: "backups/20260201T000000Z_a.pwb".into(),
                sha: Some("3".into()),
                size: None,
                download_url: None,
            },
        ];
        let drop = prune_plan(&files, 2);
        assert_eq!(drop.len(), 1);
        assert!(drop[0].path.contains("20260101"));
    }

    #[test]
    fn backup_name_has_prefix() {
        let name = backup_filename("abc123");
        assert!(name.starts_with("backups/"));
        assert!(name.ends_with("_abc123.pwb"));
    }
}
