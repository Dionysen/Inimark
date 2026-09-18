use serde::{Deserialize, Serialize};

pub const FOLDER_DEFAULT: &str = "Default";
pub const FOLDER_TRASH: &str = "PW_Trash";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub created_time: i64,
    pub description: Option<String>,
    pub rank: i64,
    pub deleted: i64,
    pub deleted_time: i64,
    pub selected_article_id: Option<String>,
    pub selected_article_id1: Option<String>,
    pub selected_outline_id: Option<String>,
    pub extension: Option<String>,
    pub update_time: i64,
    pub rank_update_time: i64,
    pub auto_chapter: i64,
    pub auto_chapter_update_time: i64,
    pub auto_chapter_reset_for_category: i64,
    pub auto_chapter_reset_for_category_update_time: i64,
    pub auto_chapter_replace_bad_prefix: i64,
    pub auto_chapter_replace_bad_prefix_update_time: i64,
    pub tags: Option<String>,
    pub tags_update_time: i64,
    pub rank_mode: Option<String>,
    pub rank_mode_update_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub folder_id: String,
    pub name: String,
    pub created_time: i64,
    pub collapsed: i64,
    pub rank: i64,
    pub description: Option<String>,
    pub rank_update_time: i64,
    pub folder_id_update_time: i64,
    pub update_time: i64,
    pub deleted: i64,
    pub deleted_time: i64,
    pub order_key: Option<String>,
    pub structure_update_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Article {
    pub id: String,
    pub title: String,
    pub content: String,
    pub summary: Option<String>,
    pub count: Option<i64>,
    pub extension: String,
    pub preview: i64,
    pub preview1: i64,
    pub update_time: i64,
    pub create_time: i64,
    pub folder_id: String,
    pub category_id: Option<String>,
    pub editor_id: i64,
    pub rank: i64,
    pub title_update_time: i64,
    pub rank_update_time: i64,
    pub folder_id_update_time: i64,
    pub category_id_update_time: i64,
    pub extension_update_time: i64,
    pub deleted: i64,
    pub deleted_time: i64,
    pub auto_chapter: i64,
    pub auto_chapter_update_time: i64,
    pub order_key: Option<String>,
    pub structure_update_time: i64,
}

/// Article list row without full content (for sidebar).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleMeta {
    pub id: String,
    pub title: String,
    pub summary: Option<String>,
    pub count: Option<i64>,
    pub extension: String,
    pub update_time: i64,
    pub create_time: i64,
    pub folder_id: String,
    pub category_id: Option<String>,
    pub rank: i64,
    pub deleted: i64,
    pub order_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub update_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Shortcut {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub cursor_index_start: i64,
    pub cursor_index_end: i64,
    pub rank: i64,
    pub deletable: i64,
    pub folder_id: Option<String>,
    pub update_time: i64,
    pub rank_update_time: i64,
    pub deleted: i64,
    pub deleted_time: i64,
    pub line_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Daily {
    pub id: i64,
    pub year: i64,
    pub month: i64,
    pub day: i64,
    pub article_id: String,
    pub article_title: String,
    pub folder_id: String,
    pub folder_title: String,
    pub inputting_duration: i64,
    pub foreground_duration: i64,
    pub word_count: i64,
    pub word_count_mode: String,
    pub count_full_word: i64,
    pub extras: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub create_time: i64,
    pub article_id: Option<String>,
    pub article_title: Option<String>,
    pub article_content: Option<String>,
    pub article_summary: Option<String>,
    pub article_count: Option<i64>,
    pub article_extension: Option<String>,
    pub article_folder_id: Option<String>,
    pub article_category_id: Option<String>,
    pub article_update_time: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolder {
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFolder {
    pub name: Option<String>,
    pub description: Option<String>,
    /// `None` leaves tags unchanged. `Some(None)` clears them. `Some(Some)` sets them.
    pub tags: Option<Option<String>>,
    pub rank: Option<i64>,
    pub selected_article_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategory {
    pub folder_id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategory {
    pub name: Option<String>,
    pub description: Option<String>,
    pub folder_id: Option<String>,
    pub rank: Option<i64>,
    pub collapsed: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateArticle {
    pub title: String,
    pub content: String,
    pub folder_id: String,
    pub category_id: Option<String>,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateArticle {
    pub title: Option<String>,
    pub content: Option<String>,
    pub folder_id: Option<String>,
    pub category_id: Option<Option<String>>,
    pub extension: Option<String>,
    pub rank: Option<i64>,
}
