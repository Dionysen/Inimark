use rusqlite::{params, Row};

use crate::error::{Error, Result};
use crate::library::Library;
use crate::models::Shortcut;
use crate::time::now_ms;

fn map_shortcut(row: &Row<'_>) -> rusqlite::Result<Shortcut> {
    Ok(Shortcut {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        cursor_index_start: row.get(3)?,
        cursor_index_end: row.get(4)?,
        rank: row.get(5)?,
        deletable: row.get(6)?,
        folder_id: row.get(7)?,
        update_time: row.get(8)?,
        rank_update_time: row.get(9)?,
        deleted: row.get(10)?,
        deleted_time: row.get(11)?,
        line_id: row.get(12)?,
    })
}

const COLS: &str = "id, title, content, cursorIndexStart, cursorIndexEnd, rank, deletable,
 folderId, updateTime, rankUpdateTime, deleted, deletedTime, lineId";

impl Library {
    pub fn list_shortcuts(&self, include_deleted: bool) -> Result<Vec<Shortcut>> {
        let sql = if include_deleted {
            format!("SELECT {COLS} FROM Shortcut ORDER BY rank ASC")
        } else {
            format!("SELECT {COLS} FROM Shortcut WHERE deleted = 0 ORDER BY rank ASC")
        };
        let mut stmt = self.conn().prepare(&sql)?;
        let rows = stmt.query_map([], map_shortcut)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn upsert_shortcut_text(
        &mut self,
        title: &str,
        content: &str,
        rank: i64,
    ) -> Result<Shortcut> {
        self.ensure_writable()?;
        let now = now_ms();
        self.conn().execute(
            "INSERT INTO Shortcut (
              title, content, cursorIndexStart, cursorIndexEnd, rank, deletable,
              folderId, updateTime, rankUpdateTime, deleted, deletedTime, lineId
            ) VALUES (?1, ?2, 0, 0, ?3, 1, NULL, ?4, ?4, 0, 0, 0)",
            params![title, content, rank, now],
        )?;
        let id = self.conn().last_insert_rowid();
        self.get_shortcut(id)
    }

    pub fn get_shortcut(&self, id: i64) -> Result<Shortcut> {
        let mut stmt = self
            .conn()
            .prepare(&format!("SELECT {COLS} FROM Shortcut WHERE id = ?1"))?;
        stmt.query_row(params![id], map_shortcut)
            .map_err(|_| Error::NotFound(format!("shortcut:{id}")))
    }

    pub fn soft_delete_shortcut(&mut self, id: i64) -> Result<()> {
        self.ensure_writable()?;
        let now = now_ms();
        let n = self.conn().execute(
            "UPDATE Shortcut SET deleted = 1, deletedTime = ?2, updateTime = ?2 WHERE id = ?1",
            params![id, now],
        )?;
        if n == 0 {
            return Err(Error::NotFound(format!("shortcut:{id}")));
        }
        Ok(())
    }
}
