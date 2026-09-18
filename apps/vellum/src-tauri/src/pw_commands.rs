//! Tauri IPC for Pure Writer library — one open library per app process.

use std::path::PathBuf;
use std::sync::Mutex;

use purewriter_store::{
    CreateArticle, CreateCategory, CreateFolder, Library, SchemaStatus, UpdateArticle,
    UpdateCategory, UpdateFolder,
};
use serde::Serialize;
use tauri::{Manager, State};

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

/// Timed local `.pwb` under `App/Backups`. No-op when no writable library is open.
#[tauri::command]
pub async fn pw_local_pwb_backup(app: tauri::AppHandle) -> Result<(), CommandError> {
    spawn_git(move || {
        let pw = app.state::<PwState>();
        let guard = pw.lib.lock().map_err(|e| CommandError {
            code: "lock".into(),
            message: e.to_string(),
        })?;
        let Some(lib) = guard.as_ref() else {
            return Ok(());
        };
        if !lib.writes_allowed() {
            return Ok(());
        }
        lib.write_local_pwb_backup().map(|_| ()).map_err(map_err)
    })
    .await
}

/// Close the open library, then start a detached process that uploads the backup.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetachCloudBackupInput {
    pub app_id: String,
    pub success_title: String,
    pub success_body: String,
    pub fail_title: String,
    pub fail_message: String,
    pub retry_label: String,
    pub exit_label: String,
}

#[tauri::command]
pub async fn pw_detach_cloud_backup(
    app: tauri::AppHandle,
    input: DetachCloudBackupInput,
) -> Result<(), CommandError> {
    spawn_git(move || {
        let pw = app.state::<PwState>();
        let mut guard = pw.lib.lock().map_err(|e| CommandError {
            code: "lock".into(),
            message: e.to_string(),
        })?;
        let root = guard.take().map(|lib| {
            let root = lib.root().to_path_buf();
            let writable = lib.writes_allowed();
            drop(lib);
            writable.then_some(root)
        });
        drop(guard);
        let root = match root {
            Some(Some(root)) => Some(root),
            Some(None) => return Ok(()),
            None => None,
        };
        let job = crate::cloud_backup::CloudBackupJob {
            app_id: input.app_id,
            library_root: String::new(),
            success_title: input.success_title,
            success_body: input.success_body,
            fail_title: input.fail_title,
            fail_message: input.fail_message,
            retry_label: input.retry_label,
            exit_label: input.exit_label,
        };
        crate::cloud_backup::detach_cloud_backup(root, job).map_err(|e| CommandError {
            code: "git_sync".into(),
            message: e,
        })
    })
    .await
}

/// One in-app cloud push at a time. A click while one is running asks for one more pass.
struct PushGate {
    running: bool,
    follow_up: bool,
}

static PUSH_GATE: Mutex<PushGate> = Mutex::new(PushGate {
    running: false,
    follow_up: false,
});

/// Returns false when a push is already running. That click is remembered as one follow-up.
fn begin_push(gate: &mut PushGate) -> bool {
    if gate.running {
        gate.follow_up = true;
        return false;
    }
    gate.running = true;
    gate.follow_up = false;
    true
}

/// After one pass: true means run again with the latest library. False releases the gate.
fn finish_push_pass(gate: &mut PushGate) -> bool {
    if gate.follow_up {
        gate.follow_up = false;
        true
    } else {
        gate.running = false;
        false
    }
}

/// Sync open library with GitHub/Gitee PWB backups.
///
/// The snapshot is taken under the library lock, then the lock is released before
/// the upload, so editing stays possible. A second click does not start a parallel
/// upload; it asks this push to run once more when the current pass finishes.
#[tauri::command]
pub async fn pw_git_push_now(
    app: tauri::AppHandle,
    app_id: String,
) -> Result<dionysen_git_sync::PushResult, CommandError> {
    spawn_git(move || {
        {
            let mut gate = PUSH_GATE.lock().map_err(|e| CommandError {
                code: "lock".into(),
                message: e.to_string(),
            })?;
            if !begin_push(&mut gate) {
                return Err(CommandError {
                    code: "sync_busy".into(),
                    message: "sync already running".into(),
                });
            }
        }
        let result = run_manual_push(&app, &app_id);
        if let Ok(mut gate) = PUSH_GATE.lock() {
            if gate.running {
                gate.running = false;
                gate.follow_up = false;
            }
        }
        result
    })
    .await
}

fn run_manual_push(
    app: &tauri::AppHandle,
    app_id: &str,
) -> Result<dionysen_git_sync::PushResult, CommandError> {
    loop {
        dionysen_git_sync::emit_status(app, "syncing", Some("pushing backup…".into()), None);
        let prepared = match snapshot_open_library(app, app_id) {
            Ok(prepared) => prepared,
            Err(err) => {
                if push_again() {
                    continue;
                }
                dionysen_git_sync::emit_status(app, "error", None, Some(err.message.clone()));
                return Err(err);
            }
        };
        let git = app.state::<dionysen_git_sync::GitSyncState>();
        let vault = match git.vault() {
            Ok(vault) => vault,
            Err(message) => {
                if push_again() {
                    continue;
                }
                dionysen_git_sync::emit_status(app, "error", None, Some(message.clone()));
                return Err(CommandError {
                    code: "git_sync".into(),
                    message,
                });
            }
        };
        match dionysen_git_sync::upload_prepared_push(&vault, app_id, prepared) {
            Ok(result) => {
                if push_again() {
                    continue;
                }
                dionysen_git_sync::emit_status(
                    app,
                    "ok",
                    Some(format!("pushed {}", result.path)),
                    None,
                );
                return Ok(result);
            }
            Err(err) => {
                if push_again() {
                    continue;
                }
                let message = err.to_string();
                dionysen_git_sync::emit_status(app, "error", None, Some(message.clone()));
                return Err(CommandError {
                    code: "git_sync".into(),
                    message,
                });
            }
        }
    }
}

fn push_again() -> bool {
    PUSH_GATE
        .lock()
        .map(|mut gate| finish_push_pass(&mut gate))
        .unwrap_or(false)
}

/// Copy the open library to a `.pwb` and drop the library lock before returning.
fn snapshot_open_library(
    app: &tauri::AppHandle,
    app_id: &str,
) -> Result<dionysen_git_sync::PreparedPush, CommandError> {
    let pw = app.state::<PwState>();
    let git = app.state::<dionysen_git_sync::GitSyncState>();
    let guard = pw.lib.lock().map_err(|e| CommandError {
        code: "lock".into(),
        message: e.to_string(),
    })?;
    let lib = guard.as_ref().ok_or(CommandError {
        code: "not_open".into(),
        message: "library is not open — open a Pure Writer folder first".into(),
    })?;
    let vault = git.vault().map_err(|e| CommandError {
        code: "git_sync".into(),
        message: e,
    })?;
    dionysen_git_sync::prepare_push(&vault, app_id, lib).map_err(|e| CommandError {
        code: "git_sync".into(),
        message: e.to_string(),
    })
}

/// Pulls a backup on a blocking thread. See [`pw_git_push_now`].
#[tauri::command]
pub async fn pw_git_restore(
    app: tauri::AppHandle,
    app_id: String,
    remote_path: String,
    mode: String,
) -> Result<dionysen_git_sync::RestoreResult, CommandError> {
    spawn_git(move || {
        let pw = app.state::<PwState>();
        let git = app.state::<dionysen_git_sync::GitSyncState>();
        restore_backup(&app, &pw, &git, &app_id, &remote_path, &mode)
    })
    .await
}

async fn spawn_git<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, CommandError> + Send + 'static,
) -> Result<T, CommandError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .unwrap_or_else(|err| {
            Err(CommandError {
                code: "git_sync".into(),
                message: err.to_string(),
            })
        })
}

fn restore_backup(
    app: &tauri::AppHandle,
    pw: &PwState,
    git: &dionysen_git_sync::GitSyncState,
    app_id: &str,
    remote_path: &str,
    mode: &str,
) -> Result<dionysen_git_sync::RestoreResult, CommandError> {
    dionysen_git_sync::emit_status(
        app,
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
            dionysen_git_sync::download_backup_for_overwrite(git, app_id, remote_path, &cache)
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
        dionysen_git_sync::merge_restore_with_library(git, app_id, lib, remote_path).map_err(
            |e| CommandError {
                code: "git_sync".into(),
                message: e,
            },
        )
    };

    match &result {
        Ok(_) => dionysen_git_sync::emit_status(app, "ok", Some("restore finished".into()), None),
        Err(e) => dionysen_git_sync::emit_status(app, "error", None, Some(e.message.clone())),
    }
    result
}

#[cfg(test)]
mod push_gate_tests {
    use super::{begin_push, finish_push_pass, PushGate};

    #[test]
    fn second_click_while_running_is_one_follow_up() {
        let mut gate = PushGate {
            running: false,
            follow_up: false,
        };
        assert!(begin_push(&mut gate));
        assert!(!begin_push(&mut gate));
        assert!(gate.follow_up);
        assert!(finish_push_pass(&mut gate));
        assert!(!gate.follow_up);
        assert!(gate.running);
        assert!(!finish_push_pass(&mut gate));
        assert!(!gate.running);
    }

    #[test]
    fn a_click_after_the_gate_is_free_starts_a_new_push() {
        let mut gate = PushGate {
            running: true,
            follow_up: false,
        };
        assert!(!finish_push_pass(&mut gate));
        assert!(begin_push(&mut gate));
        assert!(gate.running);
        assert!(!gate.follow_up);
    }
}
