use rusqlite::{params, OptionalExtension, Row};

use crate::error::Result;
use crate::library::Library;
use crate::models::Setting;
use crate::time::now_ms;

fn map_setting(row: &Row<'_>) -> rusqlite::Result<Setting> {
    Ok(Setting {
        key: row.get(0)?,
        value: row.get(1)?,
        update_time: row.get(2)?,
    })
}

impl Library {
    pub fn list_settings(&self) -> Result<Vec<Setting>> {
        let mut stmt = self
            .conn()
            .prepare("SELECT key, value, updateTime FROM Setting ORDER BY key")?;
        let rows = stmt.query_map([], map_setting)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<Setting>> {
        let mut stmt = self
            .conn()
            .prepare("SELECT key, value, updateTime FROM Setting WHERE key = ?1")?;
        Ok(stmt.query_row(params![key], map_setting).optional()?)
    }

    pub fn set_setting(&mut self, key: &str, value: &str) -> Result<Setting> {
        self.ensure_writable()?;
        let now = now_ms();
        self.conn().execute(
            "INSERT INTO Setting (key, value, updateTime) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updateTime = excluded.updateTime",
            params![key, value, now],
        )?;
        Ok(Setting {
            key: key.to_string(),
            value: value.to_string(),
            update_time: now,
        })
    }
}
