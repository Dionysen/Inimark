use tauri::{AppHandle, Manager};

const SETTINGS_WINDOW_LABEL: &str = "settings";
const MAIN_WINDOW_LABEL: &str = "main";

/// Show the settings window when hidden, otherwise hide it and refocus main.
#[tauri::command]
pub fn toggle_settings_window(app: AppHandle) -> Result<(), String> {
    let settings = app
        .get_webview_window(SETTINGS_WINDOW_LABEL)
        .ok_or_else(|| "Settings window is not configured".to_string())?;

    let visible = settings.is_visible().map_err(|e| e.to_string())?;
    if visible {
        settings.hide().map_err(|e| e.to_string())?;
        if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            let _ = main.set_focus();
        }
        return Ok(());
    }

    settings.show().map_err(|e| e.to_string())?;
    settings.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}
