use rusqlite::{params, Row};

use crate::error::{Error, Result};
use crate::ids::new_id;
use crate::library::Library;
use crate::models::{Category, CreateCategory, UpdateCategory};
use crate::order_key::next_order_key;
use crate::time::now_ms;

fn map_category(row: &Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        name: row.get(2)?,
        created_time: row.get(3)?,
        collapsed: row.get(4)?,
        rank: row.get(5)?,
        description: row.get(6)?,
        rank_update_time: row.get(7)?,
        folder_id_update_time: row.get(8)?,
        update_time: row.get(9)?,
        deleted: row.get(10)?,
        deleted_time: row.get(11)?,
        order_key: row.get(12)?,
        structure_update_time: row.get(13)?,
    })
}

const CAT_COLS: &str = "id, folderId, name, createdTime, collapsed, rank, description,
 rankUpdateTime, folderIdUpdateTime, updateTime, deleted, deletedTime, orderKey, structureUpdateTime";

impl Library {
    pub fn list_categories(&self, folder_id: Option<&str>, include_deleted: bool) -> Result<Vec<Category>> {
        let (sql, owned): (String, Option<String>) = match (folder_id, include_deleted) {
            (Some(fid), false) => (
                format!(
                    "SELECT {CAT_COLS} FROM Category WHERE folderId = ?1 AND deleted = 0 ORDER BY orderKey ASC, rank ASC"
                ),
                Some(fid.to_string()),
            ),
            (Some(fid), true) => (
                format!(
                    "SELECT {CAT_COLS} FROM Category WHERE folderId = ?1 ORDER BY orderKey ASC, rank ASC"
                ),
                Some(fid.to_string()),
            ),
            (None, false) => (
                format!(
                    "SELECT {CAT_COLS} FROM Category WHERE deleted = 0 ORDER BY folderId, orderKey ASC, rank ASC"
                ),
                None,
            ),
            (None, true) => (
                format!("SELECT {CAT_COLS} FROM Category ORDER BY folderId, orderKey ASC, rank ASC"),
                None,
            ),
        };
        let mut stmt = self.conn().prepare(&sql)?;
        let rows = if let Some(fid) = owned {
            stmt.query_map(params![fid], map_category)?
                .filter_map(|r| r.ok())
                .collect()
        } else {
            stmt.query_map([], map_category)?
                .filter_map(|r| r.ok())
                .collect()
        };
        Ok(rows)
    }

    pub fn get_category(&self, id: &str) -> Result<Category> {
        let mut stmt = self
            .conn()
            .prepare(&format!("SELECT {CAT_COLS} FROM Category WHERE id = ?1"))?;
        stmt.query_row(params![id], map_category)
            .map_err(|_| Error::NotFound(format!("category:{id}")))
    }

    pub fn create_category(&mut self, input: CreateCategory) -> Result<Category> {
        self.ensure_writable()?;
        let _ = self.get_folder(&input.folder_id)?;
        let now = now_ms();
        let id = new_id();
        let max_key: Option<String> = self
            .conn()
            .query_row(
                "SELECT orderKey FROM Category WHERE folderId = ?1 AND deleted = 0 ORDER BY orderKey DESC LIMIT 1",
                params![input.folder_id],
                |r| r.get(0),
            )
            .ok();
        let order_key = next_order_key(max_key.as_deref());
        let max_rank: i64 = self
            .conn()
            .query_row(
                "SELECT COALESCE(MAX(rank), 0) FROM Category WHERE folderId = ?1 AND deleted = 0",
                params![input.folder_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let rank = if max_rank == 0 {
            10000
        } else {
            max_rank + 1
        };
        self.conn().execute(
            "INSERT INTO Category (
              id, folderId, name, createdTime, collapsed, rank, description,
              rankUpdateTime, folderIdUpdateTime, updateTime, deleted, deletedTime,
              orderKey, structureUpdateTime
            ) VALUES (
              ?1, ?2, ?3, ?4, 0, ?5, ?6,
              ?4, ?4, ?4, 0, 0,
              ?7, ?4
            )",
            params![
                id,
                input.folder_id,
                input.name,
                now,
                rank,
                input.description,
                order_key
            ],
        )?;
        self.get_category(&id)
    }

    pub fn update_category(&mut self, id: &str, patch: UpdateCategory) -> Result<Category> {
        self.ensure_writable()?;
        let mut cat = self.get_category(id)?;
        let now = now_ms();
        if let Some(name) = patch.name {
            cat.name = name;
            cat.update_time = now;
        }
        if let Some(description) = patch.description {
            cat.description = Some(description);
            cat.update_time = now;
        }
        if let Some(folder_id) = patch.folder_id {
            cat.folder_id = folder_id;
            cat.folder_id_update_time = now;
            cat.structure_update_time = now;
        }
        if let Some(rank) = patch.rank {
            cat.rank = rank;
            cat.rank_update_time = now;
            cat.structure_update_time = now;
        }
        if let Some(collapsed) = patch.collapsed {
            cat.collapsed = collapsed;
            cat.update_time = now;
        }
        self.conn().execute(
            "UPDATE Category SET
              name = ?2, description = ?3, folderId = ?4, folderIdUpdateTime = ?5,
              rank = ?6, rankUpdateTime = ?7, collapsed = ?8, updateTime = ?9,
              structureUpdateTime = ?10
             WHERE id = ?1",
            params![
                id,
                cat.name,
                cat.description,
                cat.folder_id,
                cat.folder_id_update_time,
                cat.rank,
                cat.rank_update_time,
                cat.collapsed,
                cat.update_time,
                cat.structure_update_time,
            ],
        )?;
        self.get_category(id)
    }

    pub fn soft_delete_category(&mut self, id: &str) -> Result<()> {
        self.ensure_writable()?;
        let now = now_ms();
        let n = self.conn().execute(
            "UPDATE Category SET deleted = 1, deletedTime = ?2, updateTime = ?2, structureUpdateTime = ?2 WHERE id = ?1",
            params![id, now],
        )?;
        if n == 0 {
            return Err(Error::NotFound(format!("category:{id}")));
        }
        Ok(())
    }
}
