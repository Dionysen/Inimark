use rusqlite::{params, Row};

use crate::error::Result;
use crate::library::Library;
use crate::models::HistoryEntry;

fn map_history(row: &Row<'_>) -> rusqlite::Result<HistoryEntry> {
    Ok(HistoryEntry {
        id: row.get(0)?,
        create_time: row.get(1)?,
        article_id: row.get(2)?,
        article_title: row.get(3)?,
        article_content: row.get(4)?,
        article_summary: row.get(5)?,
        article_count: row.get(6)?,
        article_extension: row.get(7)?,
        article_folder_id: row.get(8)?,
        article_category_id: row.get(9)?,
        article_update_time: row.get(10)?,
    })
}

impl Library {
    pub fn list_article_history(&self, article_id: &str, limit: usize) -> Result<Vec<HistoryEntry>> {
        let mut stmt = self.conn().prepare(
            "SELECT id, createTime, article_id, article_title, article_content, article_summary,
                    article_count, article_extension, article_folderId, article_categoryId, article_updateTime
             FROM History WHERE article_id = ?1 ORDER BY createTime DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![article_id, limit as i64], map_history)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }
}
