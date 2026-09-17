//! Field-level LWW merge of Pure Writer Room.db sources into a destination library.

use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::Result;
use crate::library::Library;
use crate::pwb::unpack_pwb;
use crate::time::now_ms;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeReport {
    pub folders_upserted: u32,
    pub categories_upserted: u32,
    pub articles_upserted: u32,
    pub settings_upserted: u32,
    pub sources: usize,
    pub changed: bool,
}

/// Merge multiple `.pwb` archives into `dest` (current open library).
pub fn merge_pwb_files_into_library(dest: &Library, pwb_paths: &[PathBuf]) -> Result<MergeReport> {
    dest.ensure_writable()?;
    let mut report = MergeReport {
        sources: pwb_paths.len(),
        ..Default::default()
    };
    if pwb_paths.is_empty() {
        return Ok(report);
    }

    let staging = dest.app_dir().join(format!(".vellum-merge-{}", now_ms()));
    std::fs::create_dir_all(&staging)?;

    let mut sorted = pwb_paths.to_vec();
    sorted.sort();

    for (i, pwb) in sorted.iter().enumerate() {
        let unpack_dir = staging.join(format!("src-{i}"));
        let unpacked = unpack_pwb(pwb, &unpack_dir)?;
        let partial = merge_db_into_library(dest, &unpacked.db_path)?;
        report.folders_upserted += partial.folders_upserted;
        report.categories_upserted += partial.categories_upserted;
        report.articles_upserted += partial.articles_upserted;
        report.settings_upserted += partial.settings_upserted;
        report.changed |= partial.changed;
    }

    let _ = std::fs::remove_dir_all(&staging);
    Ok(report)
}

/// Merge one sqlite Room.db into `dest`.
pub fn merge_db_into_library(dest: &Library, source_db: &Path) -> Result<MergeReport> {
    dest.ensure_writable()?;
    let src = Connection::open(source_db)?;
    src.busy_timeout(std::time::Duration::from_secs(5))?;

    let mut report = MergeReport::default();
    report.folders_upserted = merge_folders(dest.conn(), &src)?;
    report.categories_upserted = merge_categories(dest.conn(), &src)?;
    report.articles_upserted = merge_articles(dest.conn(), &src)?;
    report.settings_upserted = merge_settings(dest.conn(), &src)?;
    report.changed = report.folders_upserted
        + report.categories_upserted
        + report.articles_upserted
        + report.settings_upserted
        > 0;
    let _ = merge_shortcuts_union(dest.conn(), &src);
    Ok(report)
}

fn pick_newer(dest_time: i64, src_time: i64) -> bool {
    src_time > dest_time
}

fn merge_folders(dest: &Connection, src: &Connection) -> Result<u32> {
    let mut count = 0u32;
    let mut stmt = src.prepare(
        "SELECT id, name, createdTime, description, rank, deleted, deletedTime,
         selectedArticleId, selectedArticleId1, selectedOutlineId, extension,
         updateTime, rankUpdateTime, autoChapter, autoChapterUpdateTime,
         autoChapterResetForCategory, autoChapterResetForCategoryUpdateTime,
         autoChapterReplaceBadPrefix, autoChapterReplaceBadPrefixUpdateTime,
         tags, tagsUpdateTime, rankMode, rankModeUpdateTime FROM Folder",
    )?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let s_name: String = row.get(1)?;
        let created_time: i64 = row.get(2)?;
        let s_description: Option<String> = row.get(3)?;
        let s_rank: i64 = row.get(4)?;
        let s_deleted: i64 = row.get(5)?;
        let s_deleted_time: i64 = row.get(6)?;
        let s_sel: Option<String> = row.get(7)?;
        let s_sel1: Option<String> = row.get(8)?;
        let s_outline: Option<String> = row.get(9)?;
        let s_extension: Option<String> = row.get(10)?;
        let s_ut: i64 = row.get(11)?;
        let s_rank_ut: i64 = row.get(12)?;
        let s_auto: i64 = row.get(13)?;
        let s_auto_ut: i64 = row.get(14)?;
        let s_reset: i64 = row.get(15)?;
        let s_reset_ut: i64 = row.get(16)?;
        let s_prefix: i64 = row.get(17)?;
        let s_prefix_ut: i64 = row.get(18)?;
        let s_tags: Option<String> = row.get(19)?;
        let s_tags_ut: i64 = row.get(20)?;
        let s_rank_mode: Option<String> = row.get(21)?;
        let s_rank_mode_ut: i64 = row.get(22)?;

        let existing = dest
            .query_row(
                "SELECT name, description, rank, deleted, deletedTime,
                 selectedArticleId, selectedArticleId1, selectedOutlineId, extension,
                 updateTime, rankUpdateTime, autoChapter, autoChapterUpdateTime,
                 autoChapterResetForCategory, autoChapterResetForCategoryUpdateTime,
                 autoChapterReplaceBadPrefix, autoChapterReplaceBadPrefixUpdateTime,
                 tags, tagsUpdateTime, rankMode, rankModeUpdateTime, createdTime
                 FROM Folder WHERE id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, Option<String>>(1)?,
                        r.get::<_, i64>(2)?,
                        r.get::<_, i64>(3)?,
                        r.get::<_, i64>(4)?,
                        r.get::<_, Option<String>>(5)?,
                        r.get::<_, Option<String>>(6)?,
                        r.get::<_, Option<String>>(7)?,
                        r.get::<_, Option<String>>(8)?,
                        r.get::<_, i64>(9)?,
                        r.get::<_, i64>(10)?,
                        r.get::<_, i64>(11)?,
                        r.get::<_, i64>(12)?,
                        r.get::<_, i64>(13)?,
                        r.get::<_, i64>(14)?,
                        r.get::<_, i64>(15)?,
                        r.get::<_, i64>(16)?,
                        r.get::<_, Option<String>>(17)?,
                        r.get::<_, i64>(18)?,
                        r.get::<_, Option<String>>(19)?,
                        r.get::<_, i64>(20)?,
                        r.get::<_, i64>(21)?,
                    ))
                },
            )
            .optional()?;

        if let Some((
            mut d_name,
            mut d_description,
            mut d_rank,
            mut d_deleted,
            mut d_deleted_time,
            mut d_sel,
            mut d_sel1,
            mut d_outline,
            mut d_extension,
            mut d_ut,
            mut d_rank_ut,
            mut d_auto,
            mut d_auto_ut,
            mut d_reset,
            mut d_reset_ut,
            mut d_prefix,
            mut d_prefix_ut,
            mut d_tags,
            mut d_tags_ut,
            mut d_rank_mode,
            mut d_rank_mode_ut,
            d_created,
        )) = existing
        {
            let mut changed = false;
            if pick_newer(d_ut, s_ut) {
                d_name = s_name;
                d_description = s_description;
                d_sel = s_sel;
                d_sel1 = s_sel1;
                d_outline = s_outline;
                d_extension = s_extension;
                d_ut = s_ut;
                changed = true;
            }
            if pick_newer(d_rank_ut, s_rank_ut) {
                d_rank = s_rank;
                d_rank_ut = s_rank_ut;
                changed = true;
            }
            if pick_newer(d_deleted_time, s_deleted_time) {
                d_deleted = s_deleted;
                d_deleted_time = s_deleted_time;
                changed = true;
            }
            if pick_newer(d_auto_ut, s_auto_ut) {
                d_auto = s_auto;
                d_auto_ut = s_auto_ut;
                changed = true;
            }
            if pick_newer(d_reset_ut, s_reset_ut) {
                d_reset = s_reset;
                d_reset_ut = s_reset_ut;
                changed = true;
            }
            if pick_newer(d_prefix_ut, s_prefix_ut) {
                d_prefix = s_prefix;
                d_prefix_ut = s_prefix_ut;
                changed = true;
            }
            if pick_newer(d_tags_ut, s_tags_ut) {
                d_tags = s_tags;
                d_tags_ut = s_tags_ut;
                changed = true;
            }
            if pick_newer(d_rank_mode_ut, s_rank_mode_ut) {
                d_rank_mode = s_rank_mode;
                d_rank_mode_ut = s_rank_mode_ut;
                changed = true;
            }
            if changed {
                dest.execute(
                    "UPDATE Folder SET name=?2, description=?3, rank=?4, deleted=?5, deletedTime=?6,
                     selectedArticleId=?7, selectedArticleId1=?8, selectedOutlineId=?9, extension=?10,
                     updateTime=?11, rankUpdateTime=?12, autoChapter=?13, autoChapterUpdateTime=?14,
                     autoChapterResetForCategory=?15, autoChapterResetForCategoryUpdateTime=?16,
                     autoChapterReplaceBadPrefix=?17, autoChapterReplaceBadPrefixUpdateTime=?18,
                     tags=?19, tagsUpdateTime=?20, rankMode=?21, rankModeUpdateTime=?22 WHERE id=?1",
                    params![
                        id,
                        d_name,
                        d_description,
                        d_rank,
                        d_deleted,
                        d_deleted_time,
                        d_sel,
                        d_sel1,
                        d_outline,
                        d_extension,
                        d_ut,
                        d_rank_ut,
                        d_auto,
                        d_auto_ut,
                        d_reset,
                        d_reset_ut,
                        d_prefix,
                        d_prefix_ut,
                        d_tags,
                        d_tags_ut,
                        d_rank_mode,
                        d_rank_mode_ut,
                    ],
                )?;
                let _ = d_created;
                count += 1;
            }
        } else {
            dest.execute(
                "INSERT INTO Folder (
                  id, name, createdTime, description, rank, deleted, deletedTime,
                  selectedArticleId, selectedArticleId1, selectedOutlineId, extension,
                  updateTime, rankUpdateTime, autoChapter, autoChapterUpdateTime,
                  autoChapterResetForCategory, autoChapterResetForCategoryUpdateTime,
                  autoChapterReplaceBadPrefix, autoChapterReplaceBadPrefixUpdateTime,
                  tags, tagsUpdateTime, rankMode, rankModeUpdateTime
                ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23)",
                params![
                    id,
                    s_name,
                    created_time,
                    s_description,
                    s_rank,
                    s_deleted,
                    s_deleted_time,
                    s_sel,
                    s_sel1,
                    s_outline,
                    s_extension,
                    s_ut,
                    s_rank_ut,
                    s_auto,
                    s_auto_ut,
                    s_reset,
                    s_reset_ut,
                    s_prefix,
                    s_prefix_ut,
                    s_tags,
                    s_tags_ut,
                    s_rank_mode,
                    s_rank_mode_ut,
                ],
            )?;
            count += 1;
        }
    }
    Ok(count)
}

fn merge_categories(dest: &Connection, src: &Connection) -> Result<u32> {
    let mut count = 0u32;
    let mut stmt = src.prepare(
        "SELECT id, folderId, name, createdTime, collapsed, rank, description,
         rankUpdateTime, folderIdUpdateTime, updateTime, deleted, deletedTime, orderKey, structureUpdateTime
         FROM Category",
    )?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let folder_id: String = row.get(1)?;
        let name: String = row.get(2)?;
        let created_time: i64 = row.get(3)?;
        let collapsed: i64 = row.get(4)?;
        let rank: i64 = row.get(5)?;
        let description: Option<String> = row.get(6)?;
        let rank_update_time: i64 = row.get(7)?;
        let folder_id_update_time: i64 = row.get(8)?;
        let update_time: i64 = row.get(9)?;
        let deleted: i64 = row.get(10)?;
        let deleted_time: i64 = row.get(11)?;
        let order_key: Option<String> = row.get(12)?;
        let structure_update_time: i64 = row.get(13)?;

        let existing = dest
            .query_row(
                "SELECT name, folderId, collapsed, rank, description, rankUpdateTime, folderIdUpdateTime,
                 updateTime, deleted, deletedTime, orderKey, structureUpdateTime FROM Category WHERE id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, i64>(2)?,
                        r.get::<_, i64>(3)?,
                        r.get::<_, Option<String>>(4)?,
                        r.get::<_, i64>(5)?,
                        r.get::<_, i64>(6)?,
                        r.get::<_, i64>(7)?,
                        r.get::<_, i64>(8)?,
                        r.get::<_, i64>(9)?,
                        r.get::<_, Option<String>>(10)?,
                        r.get::<_, i64>(11)?,
                    ))
                },
            )
            .optional()?;

        if let Some((
            mut d_name,
            mut d_folder,
            mut d_collapsed,
            mut d_rank,
            mut d_desc,
            mut d_rank_ut,
            mut d_folder_ut,
            mut d_ut,
            mut d_deleted,
            mut d_deleted_time,
            mut d_order,
            mut d_struct_ut,
        )) = existing
        {
            let mut changed = false;
            if pick_newer(d_ut, update_time) {
                d_name = name;
                d_desc = description;
                d_ut = update_time;
                changed = true;
            }
            if pick_newer(d_folder_ut, folder_id_update_time) {
                d_folder = folder_id;
                d_folder_ut = folder_id_update_time;
                changed = true;
            }
            if pick_newer(d_rank_ut, rank_update_time) {
                d_rank = rank;
                d_rank_ut = rank_update_time;
                d_collapsed = collapsed;
                changed = true;
            }
            if pick_newer(d_deleted_time, deleted_time) {
                d_deleted = deleted;
                d_deleted_time = deleted_time;
                changed = true;
            }
            if pick_newer(d_struct_ut, structure_update_time) {
                d_order = order_key;
                d_struct_ut = structure_update_time;
                changed = true;
            }
            if changed {
                dest.execute(
                    "UPDATE Category SET folderId=?2, name=?3, collapsed=?4, rank=?5, description=?6,
                     rankUpdateTime=?7, folderIdUpdateTime=?8, updateTime=?9, deleted=?10, deletedTime=?11,
                     orderKey=?12, structureUpdateTime=?13 WHERE id=?1",
                    params![
                        id,
                        d_folder,
                        d_name,
                        d_collapsed,
                        d_rank,
                        d_desc,
                        d_rank_ut,
                        d_folder_ut,
                        d_ut,
                        d_deleted,
                        d_deleted_time,
                        d_order,
                        d_struct_ut,
                    ],
                )?;
                count += 1;
            }
        } else {
            dest.execute(
                "INSERT INTO Category (
                  id, folderId, name, createdTime, collapsed, rank, description,
                  rankUpdateTime, folderIdUpdateTime, updateTime, deleted, deletedTime, orderKey, structureUpdateTime
                ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
                params![
                    id,
                    folder_id,
                    name,
                    created_time,
                    collapsed,
                    rank,
                    description,
                    rank_update_time,
                    folder_id_update_time,
                    update_time,
                    deleted,
                    deleted_time,
                    order_key,
                    structure_update_time,
                ],
            )?;
            count += 1;
        }
    }
    Ok(count)
}

fn merge_articles(dest: &Connection, src: &Connection) -> Result<u32> {
    let mut count = 0u32;
    let mut stmt = src.prepare(
        "SELECT id, title, content, summary, count, extension, preview, preview1,
         updateTime, createTime, folderId, categoryId, editorId, rank,
         titleUpdateTime, rankUpdateTime, folderIdUpdateTime, categoryIdUpdateTime, extensionUpdateTime,
         deleted, deletedTime, autoChapter, autoChapterUpdateTime, orderKey, structureUpdateTime
         FROM Article",
    )?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let content: String = row.get(2)?;
        let summary: Option<String> = row.get(3)?;
        let art_count: Option<i64> = row.get(4)?;
        let extension: String = row.get(5)?;
        let preview: i64 = row.get(6)?;
        let preview1: i64 = row.get(7)?;
        let update_time: i64 = row.get(8)?;
        let create_time: i64 = row.get(9)?;
        let folder_id: String = row.get(10)?;
        let category_id: Option<String> = row.get(11)?;
        let editor_id: i64 = row.get(12)?;
        let rank: i64 = row.get(13)?;
        let title_ut: i64 = row.get(14)?;
        let rank_ut: i64 = row.get(15)?;
        let folder_ut: i64 = row.get(16)?;
        let category_ut: i64 = row.get(17)?;
        let extension_ut: i64 = row.get(18)?;
        let deleted: i64 = row.get(19)?;
        let deleted_time: i64 = row.get(20)?;
        let auto_chapter: i64 = row.get(21)?;
        let auto_chapter_ut: i64 = row.get(22)?;
        let order_key: Option<String> = row.get(23)?;
        let structure_ut: i64 = row.get(24)?;

        let existing = dest
            .query_row(
                "SELECT title, content, summary, count, extension, preview, preview1, updateTime,
                 folderId, categoryId, editorId, rank, titleUpdateTime, rankUpdateTime, folderIdUpdateTime,
                 categoryIdUpdateTime, extensionUpdateTime, deleted, deletedTime, autoChapter, autoChapterUpdateTime,
                 orderKey, structureUpdateTime FROM Article WHERE id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, Option<String>>(2)?,
                        r.get::<_, Option<i64>>(3)?,
                        r.get::<_, String>(4)?,
                        r.get::<_, i64>(5)?,
                        r.get::<_, i64>(6)?,
                        r.get::<_, i64>(7)?,
                        r.get::<_, String>(8)?,
                        r.get::<_, Option<String>>(9)?,
                        r.get::<_, i64>(10)?,
                        r.get::<_, i64>(11)?,
                        r.get::<_, i64>(12)?,
                        r.get::<_, i64>(13)?,
                        r.get::<_, i64>(14)?,
                        r.get::<_, i64>(15)?,
                        r.get::<_, i64>(16)?,
                        r.get::<_, i64>(17)?,
                        r.get::<_, i64>(18)?,
                        r.get::<_, i64>(19)?,
                        r.get::<_, i64>(20)?,
                        r.get::<_, Option<String>>(21)?,
                        r.get::<_, i64>(22)?,
                    ))
                },
            )
            .optional()?;

        if let Some((
            mut d_title,
            mut d_content,
            mut d_summary,
            mut d_count,
            mut d_ext,
            mut d_preview,
            mut d_preview1,
            mut d_ut,
            mut d_folder,
            mut d_cat,
            d_editor,
            mut d_rank,
            mut d_title_ut,
            mut d_rank_ut,
            mut d_folder_ut,
            mut d_cat_ut,
            mut d_ext_ut,
            mut d_deleted,
            mut d_deleted_time,
            mut d_auto,
            mut d_auto_ut,
            mut d_order,
            mut d_struct_ut,
        )) = existing
        {
            let mut changed = false;
            if pick_newer(d_ut, update_time) {
                d_content = content.clone();
                d_summary = summary.clone();
                d_count = art_count;
                d_preview = preview;
                d_preview1 = preview1;
                d_ut = update_time;
                changed = true;
            }
            if pick_newer(d_title_ut, title_ut) {
                d_title = title.clone();
                d_title_ut = title_ut;
                changed = true;
            }
            if pick_newer(d_folder_ut, folder_ut) {
                d_folder = folder_id.clone();
                d_folder_ut = folder_ut;
                changed = true;
            }
            if pick_newer(d_cat_ut, category_ut) {
                d_cat = category_id.clone();
                d_cat_ut = category_ut;
                changed = true;
            }
            if pick_newer(d_ext_ut, extension_ut) {
                d_ext = extension.clone();
                d_ext_ut = extension_ut;
                changed = true;
            }
            if pick_newer(d_rank_ut, rank_ut) {
                d_rank = rank;
                d_rank_ut = rank_ut;
                changed = true;
            }
            if pick_newer(d_deleted_time, deleted_time) {
                d_deleted = deleted;
                d_deleted_time = deleted_time;
                changed = true;
            }
            if pick_newer(d_auto_ut, auto_chapter_ut) {
                d_auto = auto_chapter;
                d_auto_ut = auto_chapter_ut;
                changed = true;
            }
            if pick_newer(d_struct_ut, structure_ut) {
                d_order = order_key.clone();
                d_struct_ut = structure_ut;
                changed = true;
            }

            if changed {
                dest.execute(
                    "UPDATE Article SET title=?2, content=?3, summary=?4, count=?5, extension=?6,
                     preview=?7, preview1=?8, updateTime=?9, folderId=?10, categoryId=?11, editorId=?12, rank=?13,
                     titleUpdateTime=?14, rankUpdateTime=?15, folderIdUpdateTime=?16, categoryIdUpdateTime=?17,
                     extensionUpdateTime=?18, deleted=?19, deletedTime=?20, autoChapter=?21, autoChapterUpdateTime=?22,
                     orderKey=?23, structureUpdateTime=?24 WHERE id=?1",
                    params![
                        id,
                        d_title,
                        d_content,
                        d_summary,
                        d_count,
                        d_ext,
                        d_preview,
                        d_preview1,
                        d_ut,
                        d_folder,
                        d_cat,
                        d_editor,
                        d_rank,
                        d_title_ut,
                        d_rank_ut,
                        d_folder_ut,
                        d_cat_ut,
                        d_ext_ut,
                        d_deleted,
                        d_deleted_time,
                        d_auto,
                        d_auto_ut,
                        d_order,
                        d_struct_ut,
                    ],
                )?;
                count += 1;
            }
        } else {
            dest.execute(
                "INSERT INTO Article (
                  id, title, content, summary, count, extension, preview, preview1,
                  updateTime, createTime, folderId, categoryId, editorId, rank,
                  titleUpdateTime, rankUpdateTime, folderIdUpdateTime, categoryIdUpdateTime, extensionUpdateTime,
                  deleted, deletedTime, autoChapter, autoChapterUpdateTime, orderKey, structureUpdateTime
                ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
                params![
                    id,
                    title,
                    content,
                    summary,
                    art_count,
                    extension,
                    preview,
                    preview1,
                    update_time,
                    create_time,
                    folder_id,
                    category_id,
                    editor_id,
                    rank,
                    title_ut,
                    rank_ut,
                    folder_ut,
                    category_ut,
                    extension_ut,
                    deleted,
                    deleted_time,
                    auto_chapter,
                    auto_chapter_ut,
                    order_key,
                    structure_ut,
                ],
            )?;
            count += 1;
        }
    }
    Ok(count)
}

fn merge_settings(dest: &Connection, src: &Connection) -> Result<u32> {
    let mut count = 0u32;
    let mut stmt = src.prepare("SELECT key, value, updateTime FROM Setting")?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let key: String = row.get(0)?;
        let value: String = row.get(1)?;
        let update_time: i64 = row.get(2)?;
        let existing: Option<(String, i64)> = dest
            .query_row(
                "SELECT value, updateTime FROM Setting WHERE key = ?1",
                params![key],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let should_write = match existing {
            Some((_, d_ut)) => pick_newer(d_ut, update_time),
            None => true,
        };
        if should_write {
            dest.execute(
                "INSERT INTO Setting (key, value, updateTime) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updateTime = excluded.updateTime",
                params![key, value, update_time],
            )?;
            count += 1;
        }
    }
    Ok(count)
}

fn merge_shortcuts_union(dest: &Connection, src: &Connection) -> Result<u32> {
    let mut count = 0u32;
    let mut stmt = src.prepare(
        "SELECT title, content, cursorIndexStart, cursorIndexEnd, rank, deletable, folderId,
         updateTime, rankUpdateTime, deleted, deletedTime, lineId FROM Shortcut",
    )?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let title: String = row.get(0)?;
        let content: String = row.get(1)?;
        let c0: i64 = row.get(2)?;
        let c1: i64 = row.get(3)?;
        let rank: i64 = row.get(4)?;
        let deletable: i64 = row.get(5)?;
        let folder_id: Option<String> = row.get(6)?;
        let update_time: i64 = row.get(7)?;
        let rank_ut: i64 = row.get(8)?;
        let deleted: i64 = row.get(9)?;
        let deleted_time: i64 = row.get(10)?;
        let line_id: i64 = row.get(11)?;

        let exists = dest
            .query_row(
                "SELECT 1 FROM Shortcut WHERE title = ?1 AND content = ?2 AND updateTime = ?3 LIMIT 1",
                params![title, content, update_time],
                |_| Ok(1i32),
            )
            .optional()?
            .is_some();
        if exists {
            continue;
        }
        dest.execute(
            "INSERT INTO Shortcut (
              title, content, cursorIndexStart, cursorIndexEnd, rank, deletable, folderId,
              updateTime, rankUpdateTime, deleted, deletedTime, lineId
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                title,
                content,
                c0,
                c1,
                rank,
                deletable,
                folder_id,
                update_time,
                rank_ut,
                deleted,
                deleted_time,
                line_id
            ],
        )?;
        count += 1;
    }
    Ok(count)
}
