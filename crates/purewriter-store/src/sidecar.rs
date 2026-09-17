use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::Result;
use crate::library::Library;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScrollEntry {
    /// Scroll offset.
    #[serde(rename = "s")]
    pub scroll: i64,
    /// Timestamp.
    #[serde(rename = "t")]
    pub time: i64,
}

impl Library {
    pub fn read_scrolls(&self) -> Result<HashMap<String, ScrollEntry>> {
        let path = self.app_dir().join("Scrolls.json");
        if !path.exists() {
            return Ok(HashMap::new());
        }
        let text = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&text)?)
    }

    pub fn write_scrolls(&self, scrolls: &HashMap<String, ScrollEntry>) -> Result<()> {
        self.ensure_writable()?;
        let path = self.app_dir().join("Scrolls.json");
        let text = serde_json::to_string(scrolls)?;
        std::fs::write(path, text)?;
        Ok(())
    }

    pub fn read_tab_article_ids(&self) -> Result<Vec<String>> {
        let path = self.app_dir().join("TabArticleIds.txt");
        if !path.exists() {
            return Ok(Vec::new());
        }
        let text = std::fs::read_to_string(path)?;
        Ok(text
            .split(|c: char| c == ',' || c == '\n' || c == '\r')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect())
    }

    pub fn write_tab_article_ids(&self, ids: &[String]) -> Result<()> {
        self.ensure_writable()?;
        let path = self.app_dir().join("TabArticleIds.txt");
        std::fs::write(path, ids.join(","))?;
        Ok(())
    }

    /// Folder view state file names are base64 of folder id (often without padding).
    pub fn read_folder_view_state(&self, folder_id: &str) -> Result<Option<String>> {
        let dir = self.app_dir().join("FolderViewStates");
        if !dir.is_dir() {
            return Ok(None);
        }
        let encoded = encode_folder_view_name(folder_id);
        let path = dir.join(&encoded);
        if path.is_file() {
            return Ok(Some(std::fs::read_to_string(path)?));
        }
        // Fallback: scan for matching decoded name
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if decode_folder_view_name(&name).as_deref() == Some(folder_id) {
                return Ok(Some(std::fs::read_to_string(entry.path())?));
            }
        }
        Ok(None)
    }

    pub fn write_folder_view_state(&self, folder_id: &str, body: &str) -> Result<()> {
        self.ensure_writable()?;
        let dir = self.app_dir().join("FolderViewStates");
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(encode_folder_view_name(folder_id));
        std::fs::write(path, body)?;
        Ok(())
    }

    /// Raw JSON peek for AliyunRetention / other sidecars (read-only helper).
    pub fn read_json_sidecar(&self, relative: &str) -> Result<Option<Value>> {
        let path = self.app_dir().join(relative);
        if !path.is_file() {
            return Ok(None);
        }
        let text = std::fs::read_to_string(path)?;
        Ok(Some(serde_json::from_str(&text)?))
    }
}

fn encode_folder_view_name(folder_id: &str) -> String {
    use std::io::Write;
    // standard base64 without padding to match Pure Writer (e.g. Default -> RGVmYXVsdA== still used)
    let mut out = Vec::new();
    {
        let mut enc = base64_encode_simple(folder_id.as_bytes());
        out.append(&mut enc);
    }
    let _ = out.write(&[]);
    String::from_utf8(out).unwrap_or_default()
}

fn base64_encode_simple(data: &[u8]) -> Vec<u8> {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity((data.len() + 2) / 3 * 4);
    let mut i = 0;
    while i + 3 <= data.len() {
        let n = ((data[i] as u32) << 16) | ((data[i + 1] as u32) << 8) | (data[i + 2] as u32);
        out.push(T[((n >> 18) & 63) as usize]);
        out.push(T[((n >> 12) & 63) as usize]);
        out.push(T[((n >> 6) & 63) as usize]);
        out.push(T[(n & 63) as usize]);
        i += 3;
    }
    let rem = data.len() - i;
    if rem == 1 {
        let n = (data[i] as u32) << 16;
        out.push(T[((n >> 18) & 63) as usize]);
        out.push(T[((n >> 12) & 63) as usize]);
        out.push(b'=');
        out.push(b'=');
    } else if rem == 2 {
        let n = ((data[i] as u32) << 16) | ((data[i + 1] as u32) << 8);
        out.push(T[((n >> 18) & 63) as usize]);
        out.push(T[((n >> 12) & 63) as usize]);
        out.push(T[((n >> 6) & 63) as usize]);
        out.push(b'=');
    }
    out
}

fn decode_folder_view_name(name: &str) -> Option<String> {
    let padded = match name.len() % 4 {
        0 => name.to_string(),
        2 => format!("{name}=="),
        3 => format!("{name}="),
        _ => return None,
    };
    let bytes = base64_decode_simple(&padded)?;
    String::from_utf8(bytes).ok()
}

fn base64_decode_simple(s: &str) -> Option<Vec<u8>> {
    fn val(c: u8) -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            b'=' => Some(0),
            _ => None,
        }
    }
    let bytes = s.as_bytes();
    if bytes.len() % 4 != 0 {
        return None;
    }
    let mut out = Vec::new();
    for chunk in bytes.chunks(4) {
        let a = val(chunk[0])?;
        let b = val(chunk[1])?;
        let c = val(chunk[2])?;
        let d = val(chunk[3])?;
        let n = ((a as u32) << 18) | ((b as u32) << 12) | ((c as u32) << 6) | (d as u32);
        out.push(((n >> 16) & 255) as u8);
        if chunk[2] != b'=' {
            out.push(((n >> 8) & 255) as u8);
        }
        if chunk[3] != b'=' {
            out.push((n & 255) as u8);
        }
    }
    Some(out)
}

#[allow(dead_code)]
pub fn folder_view_path(app_dir: &Path, folder_id: &str) -> std::path::PathBuf {
    app_dir
        .join("FolderViewStates")
        .join(encode_folder_view_name(folder_id))
}
