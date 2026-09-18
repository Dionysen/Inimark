use rusqlite::{params, OptionalExtension, Row};

use crate::error::{Error, Result};
use crate::ids::new_id;
use crate::library::Library;
use crate::models::{
    Article, ArticleMeta, CreateArticle, UpdateArticle, FOLDER_TRASH,
};
use crate::order_key::{next_order_key, order_key_from_index};
use crate::time::now_ms;
use crate::util::{content_count, content_summary};

fn map_article(row: &Row<'_>) -> rusqlite::Result<Article> {
    Ok(Article {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        summary: row.get(3)?,
        count: row.get(4)?,
        extension: row.get(5)?,
        preview: row.get(6)?,
        preview1: row.get(7)?,
        update_time: row.get(8)?,
        create_time: row.get(9)?,
        folder_id: row.get(10)?,
        category_id: row.get(11)?,
        editor_id: row.get(12)?,
        rank: row.get(13)?,
        title_update_time: row.get(14)?,
        rank_update_time: row.get(15)?,
        folder_id_update_time: row.get(16)?,
        category_id_update_time: row.get(17)?,
        extension_update_time: row.get(18)?,
        deleted: row.get(19)?,
        deleted_time: row.get(20)?,
        auto_chapter: row.get(21)?,
        auto_chapter_update_time: row.get(22)?,
        order_key: row.get(23)?,
        structure_update_time: row.get(24)?,
    })
}

fn map_meta(row: &Row<'_>) -> rusqlite::Result<ArticleMeta> {
    Ok(ArticleMeta {
        id: row.get(0)?,
        title: row.get(1)?,
        summary: row.get(2)?,
        count: row.get(3)?,
        extension: row.get(4)?,
        update_time: row.get(5)?,
        create_time: row.get(6)?,
        folder_id: row.get(7)?,
        category_id: row.get(8)?,
        rank: row.get(9)?,
        deleted: row.get(10)?,
        order_key: row.get(11)?,
    })
}

const ART_COLS: &str = "id, title, content, summary, count, extension, preview, preview1,
 updateTime, createTime, folderId, categoryId, editorId, rank,
 titleUpdateTime, rankUpdateTime, folderIdUpdateTime, categoryIdUpdateTime, extensionUpdateTime,
 deleted, deletedTime, autoChapter, autoChapterUpdateTime, orderKey, structureUpdateTime";

const META_COLS: &str = "id, title, summary, count, extension, updateTime, createTime,
 folderId, categoryId, rank, deleted, orderKey";

impl Library {
    pub fn list_articles(
        &self,
        folder_id: Option<&str>,
        category_id: Option<&str>,
        include_deleted: bool,
    ) -> Result<Vec<ArticleMeta>> {
        let mut sql = format!("SELECT {META_COLS} FROM Article WHERE 1=1");
        let mut binds: Vec<String> = Vec::new();
        if let Some(fid) = folder_id {
            sql.push_str(" AND folderId = ?");
            binds.push(fid.to_string());
        }
        if let Some(cid) = category_id {
            sql.push_str(" AND categoryId = ?");
            binds.push(cid.to_string());
        }
        if !include_deleted {
            sql.push_str(" AND deleted = 0");
        }
        sql.push_str(" ORDER BY orderKey ASC, rank ASC, updateTime DESC");

        let mut stmt = self.conn().prepare(&sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = binds
            .iter()
            .map(|s| s as &dyn rusqlite::types::ToSql)
            .collect();
        let rows = stmt.query_map(params_refs.as_slice(), map_meta)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_article(&self, id: &str) -> Result<Article> {
        let mut stmt = self
            .conn()
            .prepare(&format!("SELECT {ART_COLS} FROM Article WHERE id = ?1"))?;
        stmt.query_row(params![id], map_article)
            .map_err(|_| Error::NotFound(format!("article:{id}")))
    }

    pub fn create_article(&mut self, input: CreateArticle) -> Result<Article> {
        self.ensure_writable()?;
        let _ = self.get_folder(&input.folder_id)?;
        let now = now_ms();
        let id = new_id();
        let extension = input.extension.unwrap_or_else(|| "txt".into());
        let count = content_count(&input.content);
        let summary = content_summary(&input.content, 200);

        let max_key: Option<String> = self
            .conn()
            .query_row(
                "SELECT orderKey FROM Article WHERE folderId = ?1 AND deleted = 0 ORDER BY orderKey DESC LIMIT 1",
                params![input.folder_id],
                |r| r.get(0),
            )
            .optional()?;
        let order_key = next_order_key(max_key.as_deref());
        let max_rank: i64 = self
            .conn()
            .query_row(
                "SELECT COALESCE(MAX(rank), 0) FROM Article WHERE folderId = ?1 AND deleted = 0",
                params![input.folder_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let rank = max_rank + 1;

        self.conn().execute(
            "INSERT INTO Article (
              id, title, content, summary, count, extension, preview, preview1,
              updateTime, createTime, folderId, categoryId, editorId, rank,
              titleUpdateTime, rankUpdateTime, folderIdUpdateTime, categoryIdUpdateTime, extensionUpdateTime,
              deleted, deletedTime, autoChapter, autoChapterUpdateTime, orderKey, structureUpdateTime
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, 0, 0,
              ?7, ?7, ?8, ?9, 0, ?10,
              ?7, ?7, ?7, ?7, 0,
              0, 0, 1, 0, ?11, ?7
            )",
            params![
                id,
                input.title,
                input.content,
                summary,
                count,
                extension,
                now,
                input.folder_id,
                input.category_id,
                rank,
                order_key,
            ],
        )?;
        self.get_article(&id)
    }

    pub fn update_article(&mut self, id: &str, patch: UpdateArticle) -> Result<Article> {
        self.ensure_writable()?;
        let mut art = self.get_article(id)?;
        let now = now_ms();

        if let Some(title) = patch.title {
            art.title = title;
            art.title_update_time = now;
            art.update_time = now;
        }
        if let Some(content) = patch.content {
            art.content = content;
            art.count = Some(content_count(&art.content));
            art.summary = Some(content_summary(&art.content, 200));
            art.update_time = now;
        }
        if let Some(folder_id) = patch.folder_id {
            art.folder_id = folder_id;
            art.folder_id_update_time = now;
            art.structure_update_time = now;
            art.update_time = now;
        }
        if let Some(category_id) = patch.category_id {
            art.category_id = category_id;
            art.category_id_update_time = now;
            art.structure_update_time = now;
            art.update_time = now;
        }
        if let Some(extension) = patch.extension {
            art.extension = extension;
            art.extension_update_time = now;
            art.update_time = now;
        }
        if let Some(rank) = patch.rank {
            art.rank = rank;
            art.rank_update_time = now;
            art.structure_update_time = now;
        }

        self.conn().execute(
            "UPDATE Article SET
              title = ?2, content = ?3, summary = ?4, count = ?5, extension = ?6,
              updateTime = ?7, folderId = ?8, categoryId = ?9, rank = ?10,
              titleUpdateTime = ?11, rankUpdateTime = ?12, folderIdUpdateTime = ?13,
              categoryIdUpdateTime = ?14, extensionUpdateTime = ?15,
              structureUpdateTime = ?16
             WHERE id = ?1",
            params![
                id,
                art.title,
                art.content,
                art.summary,
                art.count,
                art.extension,
                art.update_time,
                art.folder_id,
                art.category_id,
                art.rank,
                art.title_update_time,
                art.rank_update_time,
                art.folder_id_update_time,
                art.category_id_update_time,
                art.extension_update_time,
                art.structure_update_time,
            ],
        )?;
        self.get_article(id)
    }

    /// Move article into PW_Trash (keeps deleted=0 like observed Pure Writer data).
    pub fn trash_article(&mut self, id: &str) -> Result<Article> {
        self.ensure_writable()?;
        let now = now_ms();
        let n = self.conn().execute(
            "UPDATE Article SET
              folderId = ?2, folderIdUpdateTime = ?3, structureUpdateTime = ?3, updateTime = ?3,
              rankUpdateTime = ?3
             WHERE id = ?1",
            params![id, FOLDER_TRASH, now],
        )?;
        if n == 0 {
            return Err(Error::NotFound(format!("article:{id}")));
        }
        self.get_article(id)
    }

    /// Soft-delete flag (deleted=1), used for purge-from-trash semantics.
    pub fn soft_delete_article(&mut self, id: &str) -> Result<()> {
        self.ensure_writable()?;
        let now = now_ms();
        let n = self.conn().execute(
            "UPDATE Article SET deleted = 1, deletedTime = ?2, updateTime = ?2, structureUpdateTime = ?2 WHERE id = ?1",
            params![id, now],
        )?;
        if n == 0 {
            return Err(Error::NotFound(format!("article:{id}")));
        }
        Ok(())
    }

    /// Permanently remove a soft-deleted article row.
    pub fn purge_article(&mut self, id: &str) -> Result<()> {
        self.ensure_writable()?;
        let art = self.get_article(id)?;
        if art.deleted == 0 {
            return Err(Error::Other(
                "purge requires deleted=1; trash or soft-delete first".into(),
            ));
        }
        self.conn()
            .execute("DELETE FROM Article WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Permanently delete an article that is already in the trash.
    ///
    /// Refuses articles still in a book. Soft-deletes first when `deleted` is
    /// still 0 (the state `trash_article` leaves), then removes the row.
    pub fn purge_trashed_article(&mut self, id: &str) -> Result<()> {
        self.ensure_writable()?;
        let art = self.get_article(id)?;
        if art.folder_id != FOLDER_TRASH {
            return Err(Error::Other(
                "only articles in the trash can be permanently deleted".into(),
            ));
        }
        if art.deleted == 0 {
            self.soft_delete_article(id)?;
        }
        self.purge_article(id)
    }

    /// Snapshot current article into History table before a major edit (optional helper).
    pub fn snapshot_article_history(&mut self, id: &str) -> Result<i64> {
        self.ensure_writable()?;
        let art = self.get_article(id)?;
        let now = now_ms();
        self.conn().execute(
            "INSERT INTO History (
              createTime, article_id, article_title, article_content, article_summary, article_count,
              article_extension, article_preview, article_preview1, article_updateTime, article_createTime,
              article_folderId, article_categoryId, article_editorId, article_rank,
              article_titleUpdateTime, article_rankUpdateTime, article_folderIdUpdateTime,
              article_categoryIdUpdateTime, article_extensionUpdateTime, article_deleted, article_deletedTime,
              article_autoChapter, article_autoChapterUpdateTime, article_orderKey, article_structureUpdateTime
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6,
              ?7, ?8, ?9, ?10, ?11,
              ?12, ?13, ?14, ?15,
              ?16, ?17, ?18,
              ?19, ?20, ?21, ?22,
              ?23, ?24, ?25, ?26
            )",
            params![
                now,
                art.id,
                art.title,
                art.content,
                art.summary,
                art.count,
                art.extension,
                art.preview,
                art.preview1,
                art.update_time,
                art.create_time,
                art.folder_id,
                art.category_id,
                art.editor_id,
                art.rank,
                art.title_update_time,
                art.rank_update_time,
                art.folder_id_update_time,
                art.category_id_update_time,
                art.extension_update_time,
                art.deleted,
                art.deleted_time,
                art.auto_chapter,
                art.auto_chapter_update_time,
                art.order_key,
                art.structure_update_time,
            ],
        )?;
        Ok(self.conn().last_insert_rowid())
    }

    /// Rewrite sibling order. `ids` is the full new sequence (rank 1…n and matching orderKey).
    pub fn reorder_articles(&mut self, ids: &[String]) -> Result<()> {
        self.ensure_writable()?;
        let now = now_ms();
        for (i, id) in ids.iter().enumerate() {
            let rank = (i as i64) + 1;
            let key = order_key_from_index((i as u64) + 1);
            let n = self.conn().execute(
                "UPDATE Article SET rank = ?2, rankUpdateTime = ?3, orderKey = ?4, structureUpdateTime = ?3
                 WHERE id = ?1 AND deleted = 0",
                params![id, rank, now, key],
            )?;
            if n == 0 {
                return Err(Error::NotFound(format!("article:{id}")));
            }
        }
        Ok(())
    }
}
