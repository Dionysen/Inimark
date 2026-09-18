use rusqlite::{params, Row};

use crate::error::{Error, Result};
use crate::ids::new_id;
use crate::library::Library;
use crate::models::{CreateFolder, Folder, UpdateFolder, FOLDER_TRASH};
use crate::time::now_ms;

fn map_folder(row: &Row<'_>) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        name: row.get(1)?,
        created_time: row.get(2)?,
        description: row.get(3)?,
        rank: row.get(4)?,
        deleted: row.get(5)?,
        deleted_time: row.get(6)?,
        selected_article_id: row.get(7)?,
        selected_article_id1: row.get(8)?,
        selected_outline_id: row.get(9)?,
        extension: row.get(10)?,
        update_time: row.get(11)?,
        rank_update_time: row.get(12)?,
        auto_chapter: row.get(13)?,
        auto_chapter_update_time: row.get(14)?,
        auto_chapter_reset_for_category: row.get(15)?,
        auto_chapter_reset_for_category_update_time: row.get(16)?,
        auto_chapter_replace_bad_prefix: row.get(17)?,
        auto_chapter_replace_bad_prefix_update_time: row.get(18)?,
        tags: row.get(19)?,
        tags_update_time: row.get(20)?,
        rank_mode: row.get(21)?,
        rank_mode_update_time: row.get(22)?,
    })
}

const FOLDER_COLS: &str = "id, name, createdTime, description, rank, deleted, deletedTime,
 selectedArticleId, selectedArticleId1, selectedOutlineId, extension, updateTime, rankUpdateTime,
 autoChapter, autoChapterUpdateTime, autoChapterResetForCategory, autoChapterResetForCategoryUpdateTime,
 autoChapterReplaceBadPrefix, autoChapterReplaceBadPrefixUpdateTime, tags, tagsUpdateTime,
 rankMode, rankModeUpdateTime";

impl Library {
    pub fn list_folders(&self, include_deleted: bool) -> Result<Vec<Folder>> {
        let sql = if include_deleted {
            format!("SELECT {FOLDER_COLS} FROM Folder ORDER BY rank ASC, createdTime ASC")
        } else {
            format!(
                "SELECT {FOLDER_COLS} FROM Folder WHERE deleted = 0 ORDER BY rank ASC, createdTime ASC"
            )
        };
        let mut stmt = self.conn().prepare(&sql)?;
        let rows = stmt.query_map([], map_folder)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_folder(&self, id: &str) -> Result<Folder> {
        let mut stmt = self
            .conn()
            .prepare(&format!("SELECT {FOLDER_COLS} FROM Folder WHERE id = ?1"))?;
        stmt.query_row(params![id], map_folder)
            .map_err(|_| Error::NotFound(format!("folder:{id}")))
    }

    pub fn create_folder(&mut self, input: CreateFolder) -> Result<Folder> {
        self.ensure_writable()?;
        let now = now_ms();
        let id = new_id();
        let max_rank: i64 = self
            .conn()
            .query_row(
                "SELECT COALESCE(MAX(rank), -1) FROM Folder WHERE deleted = 0",
                [],
                |r| r.get(0),
            )
            .unwrap_or(-1);
        let rank = max_rank + 1;
        self.conn().execute(
            "INSERT INTO Folder (
              id, name, createdTime, description, rank, deleted, deletedTime,
              selectedArticleId, selectedArticleId1, selectedOutlineId, extension,
              updateTime, rankUpdateTime, autoChapter, autoChapterUpdateTime,
              autoChapterResetForCategory, autoChapterResetForCategoryUpdateTime,
              autoChapterReplaceBadPrefix, autoChapterReplaceBadPrefixUpdateTime,
              tags, tagsUpdateTime, rankMode, rankModeUpdateTime
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, 0, 0,
              NULL, NULL, NULL, NULL,
              ?3, ?3, 0, 0,
              0, 0,
              0, 0,
              ?6, ?3, NULL, 0
            )",
            params![id, input.name, now, input.description, rank, input.tags],
        )?;
        self.get_folder(&id)
    }

    pub fn update_folder(&mut self, id: &str, patch: UpdateFolder) -> Result<Folder> {
        self.ensure_writable()?;
        let mut folder = self.get_folder(id)?;
        let now = now_ms();
        if let Some(name) = patch.name {
            let name = name.trim().to_string();
            if name.is_empty() {
                return Err(Error::Other("book name cannot be empty".into()));
            }
            folder.name = name;
            folder.update_time = now;
        }
        if let Some(description) = patch.description {
            folder.description = Some(description);
            folder.update_time = now;
        }
        if let Some(tags) = patch.tags {
            folder.tags = tags.and_then(|value| {
                let trimmed = value.trim().to_string();
                if trimmed.is_empty() { None } else { Some(trimmed) }
            });
            folder.tags_update_time = now;
            folder.update_time = now;
        }
        if let Some(rank) = patch.rank {
            folder.rank = rank;
            folder.rank_update_time = now;
        }
        if let Some(selected) = patch.selected_article_id {
            folder.selected_article_id = Some(selected);
            folder.update_time = now;
        }
        self.conn().execute(
            "UPDATE Folder SET
              name = ?2, description = ?3, tags = ?4, tagsUpdateTime = ?5,
              rank = ?6, rankUpdateTime = ?7, selectedArticleId = ?8, updateTime = ?9
             WHERE id = ?1",
            params![
                id,
                folder.name,
                folder.description,
                folder.tags,
                folder.tags_update_time,
                folder.rank,
                folder.rank_update_time,
                folder.selected_article_id,
                folder.update_time,
            ],
        )?;
        self.get_folder(id)
    }

    pub fn soft_delete_folder(&mut self, id: &str) -> Result<()> {
        self.ensure_writable()?;
        if id == FOLDER_TRASH || id == crate::models::FOLDER_DEFAULT {
            return Err(Error::Other(format!("cannot delete system folder {id}")));
        }
        let now = now_ms();
        let n = self.conn().execute(
            "UPDATE Folder SET deleted = 1, deletedTime = ?2, updateTime = ?2 WHERE id = ?1",
            params![id, now],
        )?;
        if n == 0 {
            return Err(Error::NotFound(format!("folder:{id}")));
        }
        Ok(())
    }
}
