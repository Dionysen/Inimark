//! Tauri IPC for Pure Writer library — one open library per app process.

use std::path::PathBuf;
use std::sync::Mutex;

use purewriter_store::{
    CreateArticle, CreateCategory, CreateFolder, Library, SchemaStatus, UpdateArticle,
    UpdateCategory, UpdateFolder,
};
use serde::Serialize;
use tauri::State;

pub struct PwState {
    pub lib: Mutex<Option<Library>>,
}

impl Default for PwState {
    fn default() -> Self {
        Self {
            lib: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenLibraryResult {
    pub root: String,
    pub schema: SchemaStatus,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl From<purewriter_store::Error> for CommandError {
    fn from(e: purewriter_store::Error) -> Self {
        Self {
            code: e.code().into(),
            message: e.to_string(),
        }
    }
}

fn map_err(e: purewriter_store::Error) -> CommandError {
    e.into()
}

#[tauri::command]
pub fn pw_open(state: State<'_, PwState>, root: String) -> Result<OpenLibraryResult, CommandError> {
    let mut guard = state.lib.lock().map_err(|e| CommandError {
        code: "lock".into(),
        message: e.to_string(),
    })?;
    if guard.is_some() {
        *guard = None;
    }
    let lib = Library::open(&root).map_err(map_err)?;
    let result = OpenLibraryResult {
        root: lib.root().display().to_string(),
        schema: lib.schema_status().clone(),
    };
    *guard = Some(lib);
    Ok(result)
}

#[tauri::command]
pub fn pw_close(state: State<'_, PwState>) -> Result<(), CommandError> {
    let mut guard = state.lib.lock().map_err(|e| CommandError {
        code: "lock".into(),
        message: e.to_string(),
    })?;
    *guard = None;
    Ok(())
}

fn with_lib<T>(
    state: &State<'_, PwState>,
    f: impl FnOnce(&Library) -> Result<T, purewriter_store::Error>,
) -> Result<T, CommandError> {
    let guard = state.lib.lock().map_err(|e| CommandError {
        code: "lock".into(),
        message: e.to_string(),
    })?;
    let lib = guard.as_ref().ok_or(CommandError {
        code: "not_open".into(),
        message: "library is not open".into(),
    })?;
    f(lib).map_err(map_err)
}

fn with_lib_mut<T>(
    state: &State<'_, PwState>,
    f: impl FnOnce(&mut Library) -> Result<T, purewriter_store::Error>,
) -> Result<T, CommandError> {
    let mut guard = state.lib.lock().map_err(|e| CommandError {
        code: "lock".into(),
        message: e.to_string(),
    })?;
    let lib = guard.as_mut().ok_or(CommandError {
        code: "not_open".into(),
        message: "library is not open".into(),
    })?;
    f(lib).map_err(map_err)
}

#[tauri::command]
pub fn pw_schema_status(state: State<'_, PwState>) -> Result<SchemaStatus, CommandError> {
    with_lib(&state, |lib| Ok(lib.schema_status().clone()))
}

#[tauri::command]
pub fn pw_list_folders(
    state: State<'_, PwState>,
    include_deleted: bool,
) -> Result<Vec<purewriter_store::Folder>, CommandError> {
    with_lib(&state, |lib| lib.list_folders(include_deleted))
}

#[tauri::command]
pub fn pw_list_categories(
    state: State<'_, PwState>,
    folder_id: Option<String>,
    include_deleted: bool,
) -> Result<Vec<purewriter_store::Category>, CommandError> {
    with_lib(&state, |lib| {
        lib.list_categories(folder_id.as_deref(), include_deleted)
    })
}

#[tauri::command]
pub fn pw_list_articles(
    state: State<'_, PwState>,
    folder_id: Option<String>,
    category_id: Option<String>,
    include_deleted: bool,
) -> Result<Vec<purewriter_store::ArticleMeta>, CommandError> {
    with_lib(&state, |lib| {
        lib.list_articles(folder_id.as_deref(), category_id.as_deref(), include_deleted)
    })
}

#[tauri::command]
pub fn pw_get_article(
    state: State<'_, PwState>,
    id: String,
) -> Result<purewriter_store::Article, CommandError> {
    with_lib(&state, |lib| lib.get_article(&id))
}

#[tauri::command]
pub fn pw_create_folder(
    state: State<'_, PwState>,
    input: CreateFolder,
) -> Result<purewriter_store::Folder, CommandError> {
    with_lib_mut(&state, |lib| lib.create_folder(input))
}

#[tauri::command]
pub fn pw_update_folder(
    state: State<'_, PwState>,
    id: String,
    patch: UpdateFolder,
) -> Result<purewriter_store::Folder, CommandError> {
    with_lib_mut(&state, |lib| lib.update_folder(&id, patch))
}

#[tauri::command]
pub fn pw_create_category(
    state: State<'_, PwState>,
    input: CreateCategory,
) -> Result<purewriter_store::Category, CommandError> {
    with_lib_mut(&state, |lib| lib.create_category(input))
}

#[tauri::command]
pub fn pw_create_article(
    state: State<'_, PwState>,
    input: CreateArticle,
) -> Result<purewriter_store::Article, CommandError> {
    with_lib_mut(&state, |lib| lib.create_article(input))
}

#[tauri::command]
pub fn pw_update_article(
    state: State<'_, PwState>,
    id: String,
    patch: UpdateArticle,
) -> Result<purewriter_store::Article, CommandError> {
    with_lib_mut(&state, |lib| lib.update_article(&id, patch))
}

#[tauri::command]
pub fn pw_trash_article(
    state: State<'_, PwState>,
    id: String,
) -> Result<purewriter_store::Article, CommandError> {
    with_lib_mut(&state, |lib| lib.trash_article(&id))
}

#[tauri::command]
pub fn pw_purge_article(state: State<'_, PwState>, id: String) -> Result<(), CommandError> {
    with_lib_mut(&state, |lib| lib.purge_trashed_article(&id))
}

#[tauri::command]
pub fn pw_update_category(
    state: State<'_, PwState>,
    id: String,
    patch: UpdateCategory,
) -> Result<purewriter_store::Category, CommandError> {
    with_lib_mut(&state, |lib| lib.update_category(&id, patch))
}

#[tauri::command]
pub fn pw_delete_category(state: State<'_, PwState>, id: String) -> Result<(), CommandError> {
    with_lib_mut(&state, |lib| lib.soft_delete_category(&id))
}

#[tauri::command]
pub fn pw_reorder_articles(
    state: State<'_, PwState>,
    ids: Vec<String>,
) -> Result<(), CommandError> {
    with_lib_mut(&state, |lib| lib.reorder_articles(&ids))
}

#[tauri::command]
pub fn pw_reorder_categories(
    state: State<'_, PwState>,
    ids: Vec<String>,
) -> Result<(), CommandError> {
    with_lib_mut(&state, |lib| lib.reorder_categories(&ids))
}

#[tauri::command]
pub fn pw_list_settings(
    state: State<'_, PwState>,
) -> Result<Vec<purewriter_store::Setting>, CommandError> {
    with_lib(&state, |lib| lib.list_settings())
}

#[tauri::command]
pub fn pw_set_setting(
    state: State<'_, PwState>,
    key: String,
    value: String,
) -> Result<purewriter_store::Setting, CommandError> {
    with_lib_mut(&state, |lib| lib.set_setting(&key, &value))
}

#[tauri::command]
pub fn pw_pwb_export(state: State<'_, PwState>, path: String) -> Result<(), CommandError> {
    with_lib(&state, |lib| lib.export_library_pwb(PathBuf::from(path).as_path()))
}

#[tauri::command]
pub fn pw_pwb_import(state: State<'_, PwState>, path: String) -> Result<String, CommandError> {
    let mut guard = state.lib.lock().map_err(|e| CommandError {
        code: "lock".into(),
        message: e.to_string(),
    })?;
    let lib = guard.take().ok_or(CommandError {
        code: "not_open".into(),
        message: "library is not open".into(),
    })?;
    let root = lib.root().to_path_buf();
    let backup = lib
        .import_pwb_replace(PathBuf::from(path).as_path())
        .map_err(map_err)?;
    let reopened = Library::open(&root).map_err(map_err)?;
    *guard = Some(reopened);
    Ok(backup.display().to_string())
}

/// Sync open library with GitHub/Gitee PWB backups (uses existing library lock).
#[tauri::command]
pub fn pw_git_push_now(
    app: tauri::AppHandle,
    pw: State<'_, PwState>,
    git: State<'_, dionysen_git_sync::GitSyncState>,
    app_id: String,
) -> Result<dionysen_git_sync::PushResult, CommandError> {
    let guard = pw.lib.lock().map_err(|e| CommandError {
        code: "lock".into(),
        message: e.to_string(),
    })?;
    let lib = guard.as_ref().ok_or(CommandError {
        code: "not_open".into(),
        message: "library is not open — open a Pure Writer folder first".into(),
    })?;
    dionysen_git_sync::push_with_library(&app, &git, &app_id, lib).map_err(|e| CommandError {
        code: "git_sync".into(),
        message: e,
    })
}

#[tauri::command]
pub fn pw_git_restore(
    app: tauri::AppHandle,
    pw: State<'_, PwState>,
    git: State<'_, dionysen_git_sync::GitSyncState>,
    app_id: String,
    remote_path: String,
    mode: String,
) -> Result<dionysen_git_sync::RestoreResult, CommandError> {
    dionysen_git_sync::emit_status(
        &app,
        "syncing",
        Some(format!("restoring {remote_path}…")),
        None,
    );

    let result = if mode == "overwrite" {
        let dest = {
            let cache = std::env::temp_dir().join(format!(
                "vellum-restore-{}-{}.pwb",
                app_id,
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or(0)
            ));
            dionysen_git_sync::download_backup_for_overwrite(&git, &app_id, &remote_path, &cache)
                .map_err(|e| CommandError {
                    code: "git_sync".into(),
                    message: e,
                })?;
            cache
        };

        let mut guard = pw.lib.lock().map_err(|e| CommandError {
            code: "lock".into(),
            message: e.to_string(),
        })?;
        let lib = guard.take().ok_or(CommandError {
            code: "not_open".into(),
            message: "library is not open — open a Pure Writer folder first".into(),
        })?;
        let root = lib.root().to_path_buf();
        match lib.import_pwb_replace(&dest) {
            Ok(_) => {
                let reopened = Library::open(&root).map_err(map_err)?;
                *guard = Some(reopened);
                Ok(dionysen_git_sync::RestoreResult {
                    mode: "overwrite".into(),
                    merge: None,
                })
            }
            Err(e) => {
                // Best-effort reopen
                if let Ok(reopened) = Library::open(&root) {
                    *guard = Some(reopened);
                }
                Err(map_err(e))
            }
        }
    } else {
        let guard = pw.lib.lock().map_err(|e| CommandError {
            code: "lock".into(),
            message: e.to_string(),
        })?;
        let lib = guard.as_ref().ok_or(CommandError {
            code: "not_open".into(),
            message: "library is not open — open a Pure Writer folder first".into(),
        })?;
        dionysen_git_sync::merge_restore_with_library(&git, &app_id, lib, &remote_path).map_err(
            |e| CommandError {
                code: "git_sync".into(),
                message: e,
            },
        )
    };

    match &result {
        Ok(_) => dionysen_git_sync::emit_status(
            &app,
            "ok",
            Some("restore finished".into()),
            None,
        ),
        Err(e) => dionysen_git_sync::emit_status(&app, "error", None, Some(e.message.clone())),
    }
    result
}
