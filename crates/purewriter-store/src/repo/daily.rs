use rusqlite::{params, Row};

use crate::error::Result;
use crate::library::Library;
use crate::models::Daily;
use crate::time::now_ms;

fn map_daily(row: &Row<'_>) -> rusqlite::Result<Daily> {
    Ok(Daily {
        id: row.get(0)?,
        year: row.get(1)?,
        month: row.get(2)?,
        day: row.get(3)?,
        article_id: row.get(4)?,
        article_title: row.get(5)?,
        folder_id: row.get(6)?,
        folder_title: row.get(7)?,
        inputting_duration: row.get(8)?,
        foreground_duration: row.get(9)?,
        word_count: row.get(10)?,
        word_count_mode: row.get(11)?,
        count_full_word: row.get(12)?,
        extras: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

const COLS: &str = "id, year, month, day, articleId, articleTitle, folderId, folderTitle,
 inputtingDuration, foregroundDuration, wordCount, wordCountMode, countFullWord, extras,
 createdAt, updatedAt";

impl Library {
    pub fn list_daily(&self, limit: usize) -> Result<Vec<Daily>> {
        let mut stmt = self.conn().prepare(&format!(
            "SELECT {COLS} FROM Daily ORDER BY updatedAt DESC LIMIT ?1"
        ))?;
        let rows = stmt.query_map(params![limit as i64], map_daily)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// Record or bump a daily writing stats row.
    pub fn record_daily(
        &mut self,
        year: i64,
        month: i64,
        day: i64,
        article_id: &str,
        article_title: &str,
        folder_id: &str,
        folder_title: &str,
        word_count: i64,
        inputting_duration: i64,
        foreground_duration: i64,
    ) -> Result<Daily> {
        self.ensure_writable()?;
        let now = now_ms();
        self.conn().execute(
            "INSERT INTO Daily (
              year, month, day, articleId, articleTitle, folderId, folderTitle,
              inputtingDuration, foregroundDuration, wordCount, wordCountMode, countFullWord,
              extras, createdAt, updatedAt
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, ?7,
              ?8, ?9, ?10, '', 0,
              NULL, ?11, ?11
            )",
            params![
                year,
                month,
                day,
                article_id,
                article_title,
                folder_id,
                folder_title,
                inputting_duration,
                foreground_duration,
                word_count,
                now,
            ],
        )?;
        let id = self.conn().last_insert_rowid();
        let mut stmt = self
            .conn()
            .prepare(&format!("SELECT {COLS} FROM Daily WHERE id = ?1"))?;
        Ok(stmt.query_row(params![id], map_daily)?)
    }
}
