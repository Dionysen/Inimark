//! Push / pull PWB backups via GitHub or Gitee Contents API.

use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::error::{Error, Result};
use crate::provider::{
    backup_filename, delete_backup, download_file, ensure_private_repo, list_backup_files,
    prune_plan, upload_backup, MAX_REMOTE_BACKUPS,
};
use crate::vault::{device_id, now_secs, OauthRecord, RepoBinding, Vault};
use purewriter_store::{export_pwb, merge_pwb_files_into_library, Library, MergeReport};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub pulled: usize,
    pub pushed: bool,
    pub pruned: usize,
    pub merge: Option<MergeReport>,
    pub remote_backup_count: usize,
}

/// Ensure repo binding exists for the app profile.
pub fn ensure_repo_for_app(vault: &Vault, app_id: &str) -> Result<RepoBinding> {
    if let Some(repo) = vault.get_repo(app_id)? {
        return Ok(repo);
    }
    let oauth = vault
        .get_oauth(app_id)?
        .ok_or_else(|| Error::msg("not logged in"))?;
    let repo = ensure_private_repo(&oauth)?;
    vault.set_repo(app_id, repo.clone())?;
    Ok(repo)
}

/// Full sync against an already-open library (avoids re-acquiring `.vellum-lock`).
pub fn sync_open_library(
    vault: &Vault,
    app_id: &str,
    lib: &Library,
) -> Result<SyncResult> {
    let oauth = vault
        .get_oauth(app_id)?
        .ok_or_else(|| Error::msg("not logged in"))?;
    let repo = ensure_repo_for_app(vault, app_id)?;

    let cache = sync_cache_dir(app_id)?;
    std::fs::create_dir_all(&cache)?;

    let mut remote = list_backup_files(&oauth, &repo)?;
    remote.sort_by(|a, b| a.path.cmp(&b.path));
    let mut local_pwbs: Vec<PathBuf> = Vec::new();
    for file in &remote {
        let name = file
            .path
            .rsplit('/')
            .next()
            .unwrap_or("backup.pwb")
            .to_string();
        let dest = cache.join(&name);
        if !dest.exists() {
            let bytes = download_file(&oauth, &repo, file)?;
            std::fs::write(&dest, bytes)?;
        }
        local_pwbs.push(dest);
    }

    let merge = if local_pwbs.is_empty() {
        None
    } else {
        Some(merge_pwb_files_into_library(lib, &local_pwbs)?)
    };

    let room = lib.room_db_path();
    let room_mtime = file_mtime_secs(&room)?;
    let room_hash = file_sha256(&room)?;
    let meta = vault.get_sync_meta(app_id)?;
    let needs_push = meta.last_export_hash.as_deref() != Some(&room_hash)
        || meta.last_room_mtime != Some(room_mtime)
        || merge.as_ref().map(|m| m.changed).unwrap_or(false);

    let mut pushed = false;
    if needs_push {
        let did = meta.device_id.clone().unwrap_or_else(device_id);
        let remote_path = backup_filename(&did);
        let local_export = cache.join(
            remote_path
                .rsplit('/')
                .next()
                .unwrap_or("export.pwb"),
        );
        export_pwb(&room, &local_export, "Room.db")?;
        let bytes = std::fs::read(&local_export)?;
        upload_backup(
            &oauth,
            &repo,
            &remote_path,
            &bytes,
            &format!("Vellum PWB backup {remote_path}"),
        )?;
        pushed = true;
        vault.update_sync_meta(app_id, |m| {
            m.device_id = Some(did);
            m.last_export_hash = Some(room_hash);
            m.last_room_mtime = Some(room_mtime);
            m.last_push_at = Some(now_secs());
        })?;
    }

    let mut after = list_backup_files(&oauth, &repo)?;
    let prune = prune_plan(&after, MAX_REMOTE_BACKUPS);
    let mut pruned = 0usize;
    for file in prune {
        delete_backup(&oauth, &repo, file)?;
        pruned += 1;
    }
    if pruned > 0 {
        after = list_backup_files(&oauth, &repo)?;
    }

    vault.update_sync_meta(app_id, |m| {
        m.last_sync_at = Some(now_secs());
        m.last_pull_at = Some(now_secs());
    })?;

    Ok(SyncResult {
        pulled: local_pwbs.len(),
        pushed,
        pruned,
        merge,
        remote_backup_count: after.len(),
    })
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

pub fn after_login_bind_repo(oauth: &OauthRecord) -> Result<RepoBinding> {
    ensure_private_repo(oauth)
}
