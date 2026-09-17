//! Pack / unpack Pure Writer `.pwb` backups (7z containing Room.db + MD5 sidecars).

use std::fs::{self, File};
use std::io::Cursor;
use std::path::{Path, PathBuf};

use md5::{Digest, Md5};
use sevenz_rust2::{decompress, ArchiveEntry, ArchiveWriter};
use tempfile::TempDir;

/// MD5 of empty content — written as `MD5` inside modern Pure Writer `.pwb` archives.
const PWB_EMPTY_MD5: &str = "d41d8cd98f00b204e9800998ecf8427e";

fn md5_hex(bytes: &[u8]) -> String {
    let digest = Md5::digest(bytes);
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

fn find_db_file(dir: &Path) -> Result<PathBuf, String> {
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = fs::read_dir(&current).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if path
                .extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| e.eq_ignore_ascii_case("db"))
            {
                return Ok(path);
            }
        }
    }
    Err(".pwb archive does not contain a .db file".into())
}

/// Extract Room.db bytes from a Pure Writer `.pwb` (7z) archive.
#[tauri::command]
pub fn purewriter_unpack_pwb(pwb_bytes: Vec<u8>) -> Result<Vec<u8>, String> {
    let tmp = TempDir::new().map_err(|e| e.to_string())?;
    decompress(Cursor::new(pwb_bytes), tmp.path()).map_err(|e| e.to_string())?;
    let db_path = find_db_file(tmp.path())?;
    fs::read(db_path).map_err(|e| e.to_string())
}

/// Pack Room.db bytes into a Pure Writer `.pwb` (7z) archive.
#[tauri::command]
pub fn purewriter_pack_pwb(
    db_bytes: Vec<u8>,
    archive_base_name: String,
) -> Result<Vec<u8>, String> {
    let base = {
        let trimmed = archive_base_name.trim();
        if trimmed.is_empty() {
            "PureWriterBackup".to_string()
        } else {
            trimmed
                .trim_end_matches(".pwb")
                .trim_end_matches(".PWB")
                .trim_end_matches(".db")
                .trim_end_matches(".DB")
                .to_string()
        }
    };
    let db_name = format!("{base}.db");

    let tmp = TempDir::new().map_err(|e| e.to_string())?;
    let db_path = tmp.path().join(&db_name);
    let md5_path = tmp.path().join("MD5");
    let md5v2_path = tmp.path().join("MD5V2");
    let out_path = tmp.path().join(format!("{base}.pwb"));

    fs::write(&db_path, &db_bytes).map_err(|e| e.to_string())?;
    fs::write(&md5_path, PWB_EMPTY_MD5).map_err(|e| e.to_string())?;
    fs::write(&md5v2_path, md5_hex(&db_bytes)).map_err(|e| e.to_string())?;

    {
        let mut writer = ArchiveWriter::create(&out_path).map_err(|e| e.to_string())?;
        writer.set_encrypt_header(false);
        for (path, name) in [
            (db_path.as_path(), db_name.as_str()),
            (md5_path.as_path(), "MD5"),
            (md5v2_path.as_path(), "MD5V2"),
        ] {
            let file = File::open(path).map_err(|e| format!("open {name}: {e}"))?;
            writer
                .push_archive_entry(ArchiveEntry::from_path(path, name.to_string()), Some(file))
                .map_err(|e| format!("pack {name}: {e}"))?;
        }
        writer.finish().map_err(|e| e.to_string())?;
    }

    fs::read(out_path).map_err(|e| e.to_string())
}
