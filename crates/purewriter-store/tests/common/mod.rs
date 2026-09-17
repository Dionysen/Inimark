//! Shared DDL + helpers for synthetic Pure Writer Room.db fixtures.

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use purewriter_store::baseline_fingerprint;

pub const ROOM_DDL: &str = r#"
CREATE TABLE "Article" (id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, count INTEGER, extension TEXT NOT NULL, preview INTEGER NOT NULL, preview1 INTEGER NOT NULL, updateTime INTEGER NOT NULL, createTime INTEGER NOT NULL, folderId TEXT NOT NULL, categoryId TEXT, editorId INTEGER NOT NULL, rank INTEGER NOT NULL, titleUpdateTime INTEGER NOT NULL, rankUpdateTime INTEGER NOT NULL, folderIdUpdateTime INTEGER NOT NULL, categoryIdUpdateTime INTEGER NOT NULL, extensionUpdateTime INTEGER NOT NULL, deleted INTEGER NOT NULL, deletedTime INTEGER NOT NULL, autoChapter INTEGER NOT NULL, autoChapterUpdateTime INTEGER NOT NULL, orderKey TEXT, structureUpdateTime INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(id));
CREATE TABLE "Category" (id TEXT NOT NULL, folderId TEXT NOT NULL, name TEXT NOT NULL, createdTime INTEGER NOT NULL, collapsed INTEGER NOT NULL, rank INTEGER NOT NULL, description TEXT, rankUpdateTime INTEGER NOT NULL, folderIdUpdateTime INTEGER NOT NULL, updateTime INTEGER NOT NULL, deleted INTEGER NOT NULL, deletedTime INTEGER NOT NULL, orderKey TEXT, structureUpdateTime INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(id));
CREATE TABLE Daily (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, day INTEGER NOT NULL, articleId TEXT NOT NULL, articleTitle TEXT NOT NULL, folderId TEXT NOT NULL, folderTitle TEXT NOT NULL, inputtingDuration INTEGER NOT NULL, foregroundDuration INTEGER NOT NULL, wordCount INTEGER NOT NULL, wordCountMode TEXT NOT NULL, countFullWord INTEGER NOT NULL, extras TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE "Folder" (id TEXT NOT NULL, name TEXT NOT NULL, createdTime INTEGER NOT NULL, description TEXT, rank INTEGER NOT NULL, deleted INTEGER NOT NULL, deletedTime INTEGER NOT NULL, selectedArticleId TEXT, selectedArticleId1 TEXT, selectedOutlineId TEXT, extension TEXT, updateTime INTEGER NOT NULL, rankUpdateTime INTEGER NOT NULL, autoChapter INTEGER NOT NULL, autoChapterUpdateTime INTEGER NOT NULL, autoChapterResetForCategory INTEGER NOT NULL, autoChapterResetForCategoryUpdateTime INTEGER NOT NULL, autoChapterReplaceBadPrefix INTEGER NOT NULL, autoChapterReplaceBadPrefixUpdateTime INTEGER NOT NULL, tags TEXT, tagsUpdateTime INTEGER NOT NULL, rankMode TEXT, rankModeUpdateTime INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(id));
CREATE TABLE "History" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, createTime INTEGER NOT NULL, article_id TEXT, article_title TEXT, article_content TEXT, article_summary TEXT, article_count INTEGER, article_extension TEXT, article_preview INTEGER, article_preview1 INTEGER, article_updateTime INTEGER, article_createTime INTEGER, article_folderId TEXT, article_categoryId TEXT, article_editorId INTEGER, article_rank INTEGER, article_titleUpdateTime INTEGER, article_rankUpdateTime INTEGER, article_folderIdUpdateTime INTEGER, article_categoryIdUpdateTime INTEGER, article_extensionUpdateTime INTEGER, article_deleted INTEGER, article_deletedTime INTEGER, article_autoChapter INTEGER, article_autoChapterUpdateTime INTEGER, article_orderKey TEXT, article_structureUpdateTime INTEGER DEFAULT 0);
CREATE TABLE `License` (`id` TEXT NOT NULL, `deviceId` TEXT NOT NULL, PRIMARY KEY(`id`));
CREATE TABLE `Setting` (`key` TEXT NOT NULL, `value` TEXT NOT NULL, updateTime INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(`key`));
CREATE TABLE "Shortcut" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, cursorIndexStart INTEGER NOT NULL, cursorIndexEnd INTEGER NOT NULL, rank INTEGER NOT NULL, deletable INTEGER NOT NULL, folderId TEXT, updateTime INTEGER NOT NULL, rankUpdateTime INTEGER NOT NULL, deleted INTEGER NOT NULL, deletedTime INTEGER NOT NULL, lineId INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "UserMessage" (id TEXT NOT NULL, fromUserId TEXT NOT NULL, type TEXT NOT NULL, content BLOB NOT NULL, createdTime INTEGER NOT NULL, shownState INTEGER NOT NULL, extra TEXT, updateTime INTEGER NOT NULL, deleted INTEGER NOT NULL, deletedTime INTEGER NOT NULL, PRIMARY KEY(id));
CREATE TABLE android_metadata (locale TEXT);
CREATE TABLE room_master_table (id INTEGER PRIMARY KEY, identity_hash TEXT);
CREATE INDEX index_Article_folderId ON Article (folderId);
CREATE INDEX index_Category_folderId ON Category (folderId);
CREATE INDEX index_History_article_id ON History (article_id);
"#;

pub struct FixtureLib {
    pub root: PathBuf,
    _tmp: tempfile::TempDir,
}

impl FixtureLib {
    pub fn create(mismatched_schema: bool) -> Self {
        let tmp = tempfile::tempdir().expect("tempdir");
        let root = tmp.path().to_path_buf();
        let app = root.join("App");
        std::fs::create_dir_all(&app).unwrap();
        let room = app.join("Room.db");
        let conn = Connection::open(&room).unwrap();
        conn.execute_batch(ROOM_DDL).unwrap();
        let fp = baseline_fingerprint();
        let hash = if mismatched_schema {
            "deadbeefdeadbeefdeadbeefdeadbeef"
        } else {
            &fp.identity_hash
        };
        conn.execute(
            "INSERT INTO room_master_table (id, identity_hash) VALUES (42, ?1)",
            [hash],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO android_metadata (locale) VALUES ('zh_CN')",
            [],
        )
        .unwrap();
        conn.execute_batch(&format!("PRAGMA user_version = {};", fp.user_version))
            .unwrap();

        // Seed Default + Trash folders
        conn.execute(
            "INSERT INTO Folder (
              id, name, createdTime, description, rank, deleted, deletedTime,
              selectedArticleId, selectedArticleId1, selectedOutlineId, extension,
              updateTime, rankUpdateTime, autoChapter, autoChapterUpdateTime,
              autoChapterResetForCategory, autoChapterResetForCategoryUpdateTime,
              autoChapterReplaceBadPrefix, autoChapterReplaceBadPrefixUpdateTime,
              tags, tagsUpdateTime, rankMode, rankModeUpdateTime
            ) VALUES
              ('Default', 'Default', 1, NULL, 0, 0, 0, NULL, NULL, NULL, NULL, 0, 0, 0, 0, 0, 0, 0, 0, NULL, 0, NULL, 0),
              ('PW_Trash', 'Trash', 1, NULL, 1, 0, 0, NULL, NULL, NULL, NULL, 0, 0, 0, 0, 0, 0, 0, 0, NULL, 0, NULL, 0)",
            [],
        )
        .unwrap();
        drop(conn);

        Self { root, _tmp: tmp }
    }

    pub fn write_override(&self, json: &str) {
        std::fs::write(self.root.join("App/.vellum-purewriter.json"), json).unwrap();
    }

    pub fn room_path(&self) -> PathBuf {
        self.root.join("App/Room.db")
    }

    pub fn path(&self) -> &Path {
        &self.root
    }
}
