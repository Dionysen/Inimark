use std::process::Command;

fn normalize_open_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return trimmed.to_string();
    }
    if trimmed.contains("://") {
        return trimmed.to_string();
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("mailto:") || lower.starts_with("tel:") || lower.starts_with("file:") {
        return trimmed.to_string();
    }
    if trimmed.starts_with("//") {
        return format!("https:{trimmed}");
    }
    if trimmed.starts_with("www.") {
        return format!("https://{trimmed}");
    }
    if trimmed.starts_with("./") || trimmed.starts_with("../") || trimmed.starts_with('/') {
        return trimmed.to_string();
    }
    const FILE_SUFFIXES: [&str; 14] = [
        ".md", ".markdown", ".mdx", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp",
        ".svg", ".html", ".htm", ".json",
    ];
    if FILE_SUFFIXES.iter().any(|suffix| lower.ends_with(suffix)) {
        return trimmed.to_string();
    }
    if trimmed.contains('.') && !trimmed.contains(' ') {
        return format!("https://{trimmed}");
    }
    trimmed.to_string()
}

/// Reveal a file or folder in the system file manager (Finder / Explorer).
#[tauri::command]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let dir = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());
        Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open a URL in the system default browser.
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    let url = normalize_open_url(&url);
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open a file or folder with the OS default application.
#[tauri::command]
pub fn open_with_default_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
