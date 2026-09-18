use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use md5::{Digest, Md5};
use sevenz_rust::{Password, SevenZArchiveEntry, SevenZReader, SevenZWriter};

use crate::error::{Error, Result};
use crate::library::Library;
use crate::time::now_ms;

const EMPTY_MD5: &str = "d41d8cd98f00b204e9800998ecf8427e";

/// Timed local snapshots kept under `App/Backups`. Five minutes × 48 is about four hours.
pub const LOCAL_PWB_KEEP: usize = 48;
const LOCAL_PWB_PREFIX: &str = "vellum-";

/// Result of unpacking a `.pwb` archive.
#[derive(Debug, Clone)]
pub struct UnpackedPwb {
    pub db_path: PathBuf,
    pub md5: String,
    pub md5v2: String,
}

/// Unpack a Pure Writer `.pwb` (7z) into `dest_dir`, verifying MD5V2.
pub fn unpack_pwb(pwb_path: &Path, dest_dir: &Path) -> Result<UnpackedPwb> {
    std::fs::create_dir_all(dest_dir)?;
    let file = File::open(pwb_path)?;
    let len = file.metadata()?.len();
    let mut reader = SevenZReader::new(file, len, Password::empty())
        .map_err(|e| Error::InvalidPwb(e.to_string()))?;

    let mut md5 = String::new();
    let mut md5v2 = String::new();
    let mut db_path: Option<PathBuf> = None;

    reader
        .for_each_entries(|entry, reader| {
            let name = entry.name().to_string();
            let mut buf = Vec::new();
            reader.read_to_end(&mut buf)?;
            let out = dest_dir.join(&name);
            if let Some(parent) = out.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&out, &buf)?;
            if name.eq_ignore_ascii_case("MD5") {
                md5 = String::from_utf8_lossy(&buf).trim().to_string();
            } else if name.eq_ignore_ascii_case("MD5V2") {
                md5v2 = String::from_utf8_lossy(&buf).trim().to_string();
            } else if name.ends_with(".db") {
                db_path = Some(out);
            }
            Ok(true)
        })
        .map_err(|e| Error::InvalidPwb(e.to_string()))?;

    let db_path = db_path.ok_or_else(|| Error::InvalidPwb("missing .db in pwb".into()))?;
    if md5v2.is_empty() {
        return Err(Error::InvalidPwb("missing MD5V2".into()));
    }
    let actual = md5_file(&db_path)?;
    if actual != md5v2 {
        return Err(Error::InvalidPwb(format!(
            "MD5V2 mismatch: expected {md5v2}, got {actual}"
        )));
    }

    Ok(UnpackedPwb {
        db_path,
        md5: if md5.is_empty() {
            EMPTY_MD5.into()
        } else {
            md5
        },
        md5v2,
    })
}

/// Pack a sqlite db into a `.pwb` 7z with MD5 + MD5V2 sidecars.
pub fn export_pwb(db_path: &Path, pwb_path: &Path, archive_db_name: &str) -> Result<()> {
    if let Some(parent) = pwb_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let md5v2 = md5_file(db_path)?;

    // sevenz-rust writer wants path-based entries; stage sidecars beside the archive briefly.
    let staging = pwb_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!(".vellum-pwb-stage-{}", now_ms()));
    std::fs::create_dir_all(&staging)?;
    let md5_path = staging.join("MD5");
    let md5v2_path = staging.join("MD5V2");
    let staged_db = staging.join(archive_db_name);
    std::fs::write(&md5_path, EMPTY_MD5)?;
    std::fs::write(&md5v2_path, &md5v2)?;
    std::fs::copy(db_path, &staged_db)?;

    let result = (|| -> Result<()> {
        let mut writer = SevenZWriter::create(pwb_path)
            .map_err(|e| Error::Other(format!("7z create: {e}")))?;
        for (path, name) in [
            (md5_path.as_path(), "MD5"),
            (md5v2_path.as_path(), "MD5V2"),
            (staged_db.as_path(), archive_db_name),
        ] {
            let entry = SevenZArchiveEntry::from_path(path, name.to_string());
            let file = File::open(path)?;
            writer
                .push_archive_entry(entry, Some(file))
                .map_err(|e| Error::Other(format!("7z entry {name}: {e}")))?;
        }
        writer
            .finish()
            .map_err(|e| Error::Other(format!("7z finish: {e}")))?;
        Ok(())
    })();

    let _ = std::fs::remove_dir_all(&staging);
    result
}

impl Library {
    /// Export current Room.db to a `.pwb` path.
    pub fn export_library_pwb(&self, pwb_path: &Path) -> Result<()> {
        let stamp = now_ms();
        let name = format!("PureWriterBackup-Vellum-{stamp}.db");
        export_pwb(&self.room_db_path(), pwb_path, &name)
    }

    /// Write `App/Backups/vellum-<ms>.pwb` and drop older timed snapshots past [`LOCAL_PWB_KEEP`].
    /// Leaves Pure Writer's own `Room-before-import-*.db` files alone.
    pub fn write_local_pwb_backup(&self) -> Result<PathBuf> {
        self.ensure_writable()?;
        let dir = self.app_dir().join("Backups");
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("{LOCAL_PWB_PREFIX}{}.pwb", now_ms()));
        self.export_library_pwb(&path)?;
        prune_local_pwb(&dir, LOCAL_PWB_KEEP)?;
        Ok(path)
    }

    /// Import a `.pwb`: backup current Room.db, then replace it.
    /// Drops this library (connection + lock) before replacing files.
    pub fn import_pwb_replace(self, pwb_path: &Path) -> Result<PathBuf> {
        self.ensure_writable()?;
        let app_dir = self.app_dir().to_path_buf();
        let room = self.room_db_path();
        drop(self);

        let backups = app_dir.join("Backups");
        std::fs::create_dir_all(&backups)?;
        let stamp = now_ms();
        let backup_path = backups.join(format!("Room-before-import-{stamp}.db"));
        if room.is_file() {
            std::fs::copy(&room, &backup_path)?;
        }

        let unpack_dir = app_dir.join(format!("Cache/Unpack_vellum_{stamp}"));
        let unpacked = unpack_pwb(pwb_path, &unpack_dir)?;
        std::fs::copy(&unpacked.db_path, &room)?;
        Ok(backup_path)
    }
}

fn md5_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Md5::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Drop the oldest `vellum-*.pwb` files until `keep` remain. Other files in the folder stay.
fn prune_local_pwb(dir: &Path, keep: usize) -> Result<()> {
    let mut files = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let path = entry?.path();
        if local_pwb_stamp(&path).is_some() {
            files.push(path);
        }
    }
    files.sort_by_key(|path| local_pwb_stamp(path).unwrap_or(0));
    let extra = files.len().saturating_sub(keep);
    for path in files.into_iter().take(extra) {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

fn local_pwb_stamp(path: &Path) -> Option<u128> {
    let name = path.file_name()?.to_str()?;
    let stem = name.strip_suffix(".pwb")?;
    stem.strip_prefix(LOCAL_PWB_PREFIX)?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prune_keeps_newest_vellum_snapshots_only() {
        let dir = std::env::temp_dir().join(format!("vellum-prune-{}", now_ms()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("vellum-99.pwb"), b"old").unwrap();
        std::fs::write(dir.join("vellum-100.pwb"), b"mid").unwrap();
        std::fs::write(dir.join("vellum-101.pwb"), b"new").unwrap();
        std::fs::write(dir.join("Room-before-import-9.db"), b"keep").unwrap();

        prune_local_pwb(&dir, 2).unwrap();

        assert!(!dir.join("vellum-99.pwb").exists());
        assert!(dir.join("vellum-100.pwb").exists());
        assert!(dir.join("vellum-101.pwb").exists());
        assert!(dir.join("Room-before-import-9.db").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
