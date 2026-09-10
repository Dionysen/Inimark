use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::error::{SsgError, SsgResult};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteFile {
    /// Path relative to the output directory (forward slashes).
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCopy {
    pub from: String,
    /// Path relative to the output directory (forward slashes).
    pub to: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteSiteRequest {
    pub out_dir: String,
    pub files: Vec<SiteFile>,
    #[serde(default)]
    pub media: Vec<MediaCopy>,
    /// When true (default), wipe `out_dir` before writing.
    #[serde(default = "default_true")]
    pub clean: bool,
}

fn default_true() -> bool {
    true
}

fn normalize_rel(path: &str) -> SsgResult<PathBuf> {
    let normalized = path.replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.contains(':')
        || normalized.split('/').any(|seg| seg == ".." || seg.is_empty())
    {
        return Err(SsgError::msg(format!("invalid relative path: {path}")));
    }
    Ok(PathBuf::from(normalized))
}

fn ensure_parent(path: &Path) -> SsgResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

/// Write a prepared site to `out_dir` and copy media assets.
pub fn write_site(req: &WriteSiteRequest) -> SsgResult<String> {
    let out_dir = PathBuf::from(&req.out_dir);
    if req.clean && out_dir.exists() {
        fs::remove_dir_all(&out_dir)?;
    }
    fs::create_dir_all(&out_dir)?;

    for file in &req.files {
        let rel = normalize_rel(&file.path)?;
        let dest = out_dir.join(&rel);
        ensure_parent(&dest)?;
        fs::write(&dest, file.content.as_bytes())?;
    }

    for media in &req.media {
        let rel = match normalize_rel(&media.to) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[inimark-ssg] skip media (bad dest): {}: {e}", media.to);
                continue;
            }
        };
        let dest = out_dir.join(&rel);
        ensure_parent(&dest)?;
        let from = PathBuf::from(&media.from);
        if !from.is_file() {
            eprintln!(
                "[inimark-ssg] skip media (source missing): {}",
                media.from
            );
            continue;
        }
        fs::copy(&from, &dest)?;
    }

    Ok(out_dir.to_string_lossy().into_owned())
}
