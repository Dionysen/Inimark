fn normalize_proxy_url(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.contains("://") {
        return Some(trimmed.to_string());
    }
    Some(format!("http://{trimmed}"))
}

fn pick_proxy_url(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if !trimmed.contains('=') {
        return normalize_proxy_url(trimmed);
    }

    let mut http: Option<String> = None;
    let mut https: Option<String> = None;
    for part in trimmed.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let Some((scheme, host)) = part.split_once('=') else {
            continue;
        };
        match scheme.trim().to_ascii_lowercase().as_str() {
            "https" => https = normalize_proxy_url(host.trim()),
            "http" => http = normalize_proxy_url(host.trim()),
            _ => {}
        }
    }

    if https.is_some() {
        return https;
    }
    if http.is_some() {
        return http;
    }

    for part in trimmed.split(';') {
        let part = part.trim();
        let Some((_, host)) = part.split_once('=') else {
            continue;
        };
        if let Some(url) = normalize_proxy_url(host.trim()) {
            return Some(url);
        }
    }

    None
}

fn env_proxy_url() -> Option<String> {
    for key in [
        "HTTPS_PROXY",
        "https_proxy",
        "HTTP_PROXY",
        "http_proxy",
        "ALL_PROXY",
        "all_proxy",
    ] {
        if let Ok(value) = std::env::var(key) {
            if let Some(url) = pick_proxy_url(&value) {
                return Some(url);
            }
        }
    }
    None
}

#[cfg(windows)]
fn windows_system_proxy_url() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let settings = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;
    let enabled: u32 = settings.get_value("ProxyEnable").ok()?;
    if enabled == 0 {
        return None;
    }
    let server: String = settings.get_value("ProxyServer").ok()?;
    pick_proxy_url(&server)
}

#[cfg(not(windows))]
fn windows_system_proxy_url() -> Option<String> {
    None
}

/// Resolve the system / user proxy URL for outbound HTTP(S) requests.
pub fn resolve_system_proxy_url() -> Option<String> {
    env_proxy_url().or_else(windows_system_proxy_url)
}

/// Resolve the system / user proxy URL for outbound HTTP(S) requests.
#[tauri::command]
pub fn get_system_proxy_url() -> Option<String> {
    resolve_system_proxy_url()
}

#[cfg(test)]
mod tests {
    use super::{normalize_proxy_url, pick_proxy_url};

    #[test]
    fn normalizes_host_port_proxy() {
        assert_eq!(
            normalize_proxy_url("127.0.0.1:7890").as_deref(),
            Some("http://127.0.0.1:7890")
        );
    }

    #[test]
    fn prefers_https_proxy_from_windows_style_list() {
        assert_eq!(
            pick_proxy_url("http=127.0.0.1:7890;https=127.0.0.1:7891").as_deref(),
            Some("http://127.0.0.1:7891")
        );
    }
}
