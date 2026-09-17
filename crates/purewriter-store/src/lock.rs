use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use fs4::fs_std::FileExt;

use crate::error::{Error, Result};

const LOCK_NAME: &str = ".vellum-lock";

/// Exclusive process lock for a Pure Writer `App/` directory.
pub struct LibraryLock {
    path: PathBuf,
    file: File,
}

impl LibraryLock {
    pub fn acquire(app_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(app_dir)?;
        let path = app_dir.join(LOCK_NAME);
        match try_acquire(&path) {
            Ok(file) => Ok(Self { path, file }),
            Err(Error::Locked(_)) => {
                // Stale lock left by a crashed process: reclaim if PID is gone.
                if reclaim_stale_lock(&path)? {
                    let file = try_acquire(&path)?;
                    return Ok(Self { path, file });
                }
                Err(Error::Locked(path.display().to_string()))
            }
            Err(e) => Err(e),
        }
    }
}

fn try_acquire(path: &Path) -> Result<File> {
    let mut file = OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .truncate(true)
        .open(path)?;
    file.try_lock_exclusive()
        .map_err(|_| Error::Locked(path.display().to_string()))?;
    // Must write through the same handle — Windows rejects other writers while locked.
    let pid = std::process::id();
    writeln!(file, "vellum pid={pid}")?;
    file.flush()?;
    Ok(file)
}

fn reclaim_stale_lock(path: &Path) -> Result<bool> {
    let f = match OpenOptions::new().read(true).open(path) {
        Ok(f) => f,
        Err(_) => return Ok(false),
    };
    // If we can lock it, the previous holder is gone.
    if f.try_lock_exclusive().is_err() {
        return Ok(false);
    }
    let _ = f.unlock();
    drop(f);
    let _ = std::fs::remove_file(path);
    Ok(true)
}

#[allow(dead_code)]
fn read_lock_pid(path: &Path) -> Option<u32> {
    let mut text = String::new();
    File::open(path).ok()?.read_to_string(&mut text).ok()?;
    text.split("pid=")
        .nth(1)?
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()
}

impl Drop for LibraryLock {
    fn drop(&mut self) {
        let _ = self.file.unlock();
        let _ = std::fs::remove_file(&self.path);
    }
}
