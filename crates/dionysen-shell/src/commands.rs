use tauri::{AppHandle, State};

use crate::{show_aux_window_with, toggle_aux_window_with, WindowPolicy};

/// Show and focus the aux window (uses managed [`WindowPolicy`]).
#[tauri::command]
pub fn show_aux_window(
    app: AppHandle,
    policy: State<'_, WindowPolicy>,
) -> Result<(), String> {
    show_aux_window_with(&app, &policy)
}

/// Toggle the aux window (uses managed [`WindowPolicy`]).
#[tauri::command]
pub fn toggle_aux_window(
    app: AppHandle,
    policy: State<'_, WindowPolicy>,
) -> Result<(), String> {
    toggle_aux_window_with(&app, &policy)
}

/// Inimark / product alias for [`show_aux_window`].
#[tauri::command]
pub fn show_settings_window(
    app: AppHandle,
    policy: State<'_, WindowPolicy>,
) -> Result<(), String> {
    show_aux_window_with(&app, &policy)
}

/// Inimark / product alias for [`toggle_aux_window`].
#[tauri::command]
pub fn toggle_settings_window(
    app: AppHandle,
    policy: State<'_, WindowPolicy>,
) -> Result<(), String> {
    toggle_aux_window_with(&app, &policy)
}
