//! Push / restore PWB backups via GitHub or Gitee Contents API.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};
use crate::provider::{
    backup_filename, download_path, ensure_private_repo, list_backup_files,
    prune_plan, upload_backup, upsert_file, MAX_REMOTE_BACKUPS, DEFAULT_REPO_NAME,
};
use crate::vault::{device_id, now_secs, RepoBinding, Vault};
use purewriter_store::{
    export_pwb, merge_pwb_files_into_library, unpack_pwb, Library, MergeReport,
};

pub const MANIFEST_PATH: &str = "backups/manifest.json";
pub const STATUS_EVENT: &str = "git-sync-status";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusPayload {
    /// `idle` | `syncing` | `error` | `ok`
    pub state: String,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResult {
    pub path: String,
    pub remote_backup_count: usize,
    pub pruned: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupMeta {
    pub path: String,
    pub device_id: String,
    pub created_at: String,
    pub size: u64,
    pub article_count: u32,
    pub word_count: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    #[serde(default)]
    backups: Vec<BackupMeta>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub mode: String,
    pub merge: Option<MergeReport>,
}

/// Ensure repo binding exists; does **not** auto-create — use [`init_repo_for_app`].
pub fn ensure_repo_for_app(vault: &Vault, app_id: &str) -> Result<RepoBinding> {
    vault
        .get_repo(app_id)?
        .ok_or_else(|| Error::msg("repository not initialized — choose a name first"))
}

/// Create or bind a private repo with the user-chosen name, then ready for first push.
pub fn init_repo_for_app(vault: &Vault, app_id: &str, repo_name: &str) -> Result<RepoBinding> {
    let oauth = vault
        .get_oauth(app_id)?
        .ok_or_else(|| Error::msg("not logged in"))?;
    let name = if repo_name.trim().is_empty() {
        DEFAULT_REPO_NAME
    } else {
        repo_name.trim()
    };
    let repo = ensure_private_repo(&oauth, name)?;
    vault.set_repo(app_id, repo.clone())?;
    Ok(repo)
}

fn library_stats(lib: &Library) -> Result<(u32, i64)> {
    let arts = lib.list_articles(None, None, false)?;
    let article_count = arts.len() as u32;
    let word_count = arts.iter().filter_map(|a| a.count).sum::<i64>();
    Ok((article_count, word_count))
}

fn parse_backup_filename(path: &str) -> (String, String) {
    let name = path.rsplit('/').next().unwrap_or(path);
    let stem = name.strip_suffix(".pwb").unwrap_or(name);
    if let Some((ts, device)) = stem.split_once('_') {
        (ts.to_string(), device.to_string())
    } else {
        (stem.to_string(), "unknown".into())
    }
}

fn format_created_at(ts_token: &str) -> String {
    // 20260317T142233Z → 2026-03-17T14:22:33Z
    if ts_token.len() >= 16 && ts_token.as_bytes().get(8) == Some(&b'T') {
        let y = &ts_token[0..4];
        let mo = &ts_token[4..6];
        let d = &ts_token[6..8];
        let h = &ts_token[9..11];
        let mi = &ts_token[11..13];
        let s = &ts_token[13..15];
        format!("{y}-{mo}-{d}T{h}:{mi}:{s}Z")
    } else {
        ts_token.to_string()
    }
}

fn load_manifest(oauth: &crate::vault::OauthRecord, repo: &RepoBinding) -> Manifest {
    match download_path(oauth, repo, MANIFEST_PATH) {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => Manifest::default(),
    }
}

fn save_manifest(
    oauth: &crate::vault::OauthRecord,
    repo: &RepoBinding,
    manifest: &Manifest,
) -> Result<()> {
    let bytes = serde_json::to_vec_pretty(manifest)?;
    upsert_file(
        oauth,
        repo,
        MANIFEST_PATH,
        &bytes,
        "update Vellum backup manifest",
    )
}

/// Local `.pwb` plus the stats needed to upload it.
///
/// Built while the library lock is held. The upload does not need the library,
/// so the editor can keep writing during the network request.
pub struct PreparedPush {
    bytes: Vec<u8>,
    remote_path: String,
    device_id: String,
    article_count: u32,
    word_count: i64,
    room_mtime: i64,
    room_hash: String,
}

/// Read the open library into a `.pwb`. Does not talk to the remote.
pub fn prepare_push(vault: &Vault, app_id: &str, lib: &Library) -> Result<PreparedPush> {
    if vault.get_oauth(app_id)?.is_none() {
        return Err(Error::msg("not logged in"));
    }
    ensure_repo_for_app(vault, app_id)?;

    let cache = sync_cache_dir(app_id)?;
    std::fs::create_dir_all(&cache)?;

    let meta = vault.get_sync_meta(app_id)?;
    let did = meta.device_id.clone().unwrap_or_else(device_id);
    let remote_path = backup_filename(&did);
    let local_name = remote_path
        .rsplit('/')
        .next()
        .unwrap_or("export.pwb")
        .to_string();
    let local_export = cache.join(&local_name);

    let room = lib.room_db_path();
    export_pwb(&room, &local_export, "Room.db")?;
    let bytes = std::fs::read(&local_export)?;
    let (article_count, word_count) = library_stats(lib)?;
    Ok(PreparedPush {
        bytes,
        remote_path,
        device_id: did,
        article_count,
        word_count,
        room_mtime: file_mtime_secs(&room)?,
        room_hash: file_sha256(&room)?,
    })
}

/// Upload a snapshot prepared by [`prepare_push`]. Safe to call without the library lock.
pub fn upload_prepared_push(
    vault: &Vault,
    app_id: &str,
    prepared: PreparedPush,
) -> Result<PushResult> {
    let oauth = vault
        .get_oauth(app_id)?
        .ok_or_else(|| Error::msg("not logged in"))?;
    let repo = ensure_repo_for_app(vault, app_id)?;
    let remote_path = prepared.remote_path;
    let did = prepared.device_id;
    let size = prepared.bytes.len() as u64;

    upload_backup(
        &oauth,
        &repo,
        &remote_path,
        &prepared.bytes,
        &format!("Vellum PWB backup {remote_path}"),
    )?;

    let (ts, device) = parse_backup_filename(&remote_path);
    let entry = BackupMeta {
        path: remote_path.clone(),
        device_id: device,
        created_at: format_created_at(&ts),
        size,
        article_count: prepared.article_count,
        word_count: prepared.word_count,
    };

    let mut manifest = load_manifest(&oauth, &repo);
    manifest.backups.retain(|b| b.path != remote_path);
    manifest.backups.push(entry);
    manifest.backups.sort_by(|a, b| a.path.cmp(&b.path));
    let _ = save_manifest(&oauth, &repo, &manifest);

    let mut after = list_backup_files(&oauth, &repo)?;
    let prune = prune_plan(&after, MAX_REMOTE_BACKUPS);
    let mut pruned = 0usize;
    for file in &prune {
        let _ = crate::provider::delete_backup(&oauth, &repo, file);
        pruned += 1;
        manifest.backups.retain(|b| b.path != file.path);
    }
    if pruned > 0 {
        let _ = save_manifest(&oauth, &repo, &manifest);
        after = list_backup_files(&oauth, &repo)?;
    }

    vault.update_sync_meta(app_id, |m| {
        m.device_id = Some(did);
        m.last_export_hash = Some(prepared.room_hash);
        m.last_room_mtime = Some(prepared.room_mtime);
        m.last_push_at = Some(now_secs());
        m.last_sync_at = Some(now_secs());
    })?;

    Ok(PushResult {
        path: remote_path,
        remote_backup_count: after.len(),
        pruned,
    })
}

/// Export local library to a new `.pwb` and append-push to the bound repo.
pub fn push_backup(vault: &Vault, app_id: &str, lib: &Library) -> Result<PushResult> {
    let prepared = prepare_push(vault, app_id, lib)?;
    upload_prepared_push(vault, app_id, prepared)
}

/// List remote backups with metadata (manifest + filename fallback).
pub fn list_backups_detailed(vault: &Vault, app_id: &str) -> Result<Vec<BackupMeta>> {
    let oauth = vault
        .get_oauth(app_id)?
        .ok_or_else(|| Error::msg("not logged in"))?;
    let repo = ensure_repo_for_app(vault, app_id)?;
    let files = list_backup_files(&oauth, &repo)?;
    let manifest = load_manifest(&oauth, &repo);
    let by_path: HashMap<&str, &BackupMeta> = manifest
        .backups
        .iter()
        .map(|b| (b.path.as_str(), b))
        .collect();

    let mut out = Vec::new();
    for f in files {
        if let Some(meta) = by_path.get(f.path.as_str()) {
            let mut m = (*meta).clone();
            if let Some(size) = f.size {
                m.size = size;
            }
            out.push(m);
        } else {
            let (ts, device) = parse_backup_filename(&f.path);
            out.push(BackupMeta {
                path: f.path,
                device_id: device,
                created_at: format_created_at(&ts),
                size: f.size.unwrap_or(0),
                article_count: 0,
                word_count: 0,
            });
        }
    }
    out.sort_by(|a, b| b.path.cmp(&a.path)); // newest first
    Ok(out)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RestoreMode {
    Overwrite,
    Merge,
}

impl RestoreMode {
    #[allow(dead_code)]
    pub fn parse(s: &str) -> Result<Self> {
        match s {
            "overwrite" => Ok(Self::Overwrite),
            "merge" => Ok(Self::Merge),
            other => Err(Error::msg(format!("unknown restore mode: {other}"))),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Overwrite => "overwrite",
            Self::Merge => "merge",
        }
    }
}

/// Restore one remote backup into the open library.
pub fn restore_backup(
    vault: &Vault,
    app_id: &str,
    lib: &Library,
    remote_path: &str,
    mode: RestoreMode,
) -> Result<RestoreResult> {
    let oauth = vault
        .get_oauth(app_id)?
        .ok_or_else(|| Error::msg("not logged in"))?;
    let repo = ensure_repo_for_app(vault, app_id)?;

    let cache = sync_cache_dir(app_id)?;
    std::fs::create_dir_all(&cache)?;
    let name = remote_path
        .rsplit('/')
        .next()
        .unwrap_or("restore.pwb")
        .to_string();
    let local = cache.join(&name);
    let bytes = download_path(&oauth, &repo, remote_path)?;
    std::fs::write(&local, &bytes)?;

    match mode {
        RestoreMode::Overwrite => {
            // import_pwb_replace consumes Library by value — caller must reopen.
            Err(Error::msg(
                "overwrite restore must be handled by the app command that owns the library lock",
            ))
        }
        RestoreMode::Merge => {
            let report = merge_pwb_files_into_library(lib, &[local])?;
            vault.update_sync_meta(app_id, |m| {
                m.last_pull_at = Some(now_secs());
                m.last_sync_at = Some(now_secs());
            })?;
            Ok(RestoreResult {
                mode: mode.as_str().into(),
                merge: Some(report),
            })
        }
    }
}

/// Download backup to a local path (for overwrite import that needs owned Library).
pub fn download_backup_to(
    vault: &Vault,
    app_id: &str,
    remote_path: &str,
    dest: &Path,
) -> Result<()> {
    let oauth = vault
        .get_oauth(app_id)?
        .ok_or_else(|| Error::msg("not logged in"))?;
    let repo = ensure_repo_for_app(vault, app_id)?;
    let bytes = download_path(&oauth, &repo, remote_path)?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(dest, bytes)?;
    // Verify it's a valid pwb
    let unpack_dir = dest.with_extension("unpack-check");
    let _ = unpack_pwb(dest, &unpack_dir)?;
    let _ = std::fs::remove_dir_all(&unpack_dir);
    Ok(())
}

fn sync_cache_dir(app_id: &str) -> Result<PathBuf> {
    let base = dirs::cache_dir().ok_or_else(|| Error::msg("cannot resolve cache dir"))?;
    Ok(base.join("com.dionysen.git-sync").join(app_id).join("pwb"))
}

fn file_mtime_secs(path: &Path) -> Result<i64> {
    let meta = std::fs::metadata(path)?;
    let modified = meta.modified().map_err(Error::from)?;
    Ok(modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0))
}

fn file_sha256(path: &Path) -> Result<String> {
    let bytes = std::fs::read(path)?;
    Ok(hex::encode(Sha256::digest(&bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_filename() {
        let (ts, d) = parse_backup_filename("backups/20260317T142233Z_ab12cd.pwb");
        assert_eq!(ts, "20260317T142233Z");
        assert_eq!(d, "ab12cd");
        assert_eq!(format_created_at(&ts), "2026-03-17T14:22:33Z");
    }
}
