//! Shared dual-window chrome for Dionysen Tauri apps (main + aux/settings).

mod commands;
mod fonts;

pub use commands::{
    show_aux_window, show_settings_window, toggle_aux_window, toggle_settings_window,
};
pub use fonts::{list_system_fonts, SystemFontInfo};

use tauri::{App, AppHandle, Manager, RunEvent, Runtime, Window, WindowEvent, WebviewWindow};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

/// Labels for the primary editor window and a secondary aux window (settings).
#[derive(Debug, Clone)]
pub struct WindowPolicy {
    pub main_label: &'static str,
    pub aux_label: &'static str,
}

impl Default for WindowPolicy {
    fn default() -> Self {
        Self {
            main_label: "main",
            aux_label: "settings",
        }
    }
}

impl WindowPolicy {
    pub fn window_labels(&self) -> [&'static str; 2] {
        [self.main_label, self.aux_label]
    }
}

/// Window geometry / maximize / fullscreen — not decorations or visibility.
/// Decorations are platform chrome (custom titlebar); visibility is applied
/// after chrome so Windows never flashes a transparent native title bar.
pub const WINDOW_STATE_FLAGS: StateFlags = StateFlags::from_bits_truncate(
    StateFlags::SIZE.bits()
        | StateFlags::POSITION.bits()
        | StateFlags::MAXIMIZED.bits()
        | StateFlags::FULLSCREEN.bits(),
);

/// Apply OS-specific chrome while the window is still hidden, then show main.
///
/// Config keeps `decorations: true` so macOS can place Overlay traffic lights
/// (`trafficLightPosition`) at webview creation. Windows strips decorations
/// here before `show()`, which is what avoids the startup title-bar flash.
pub fn apply_platform_chrome<R: Runtime>(window: &WebviewWindow<R>) {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.set_decorations(false);
    }
    #[cfg(target_os = "windows")]
    {
        let _ = window.set_shadow(true);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = window.set_decorations(true);
        let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
    }
}

/// Apply chrome to main/aux windows, show main, hide aux.
pub fn setup_dual_windows<R: Runtime>(app: &App<R>, policy: &WindowPolicy) {
    for label in policy.window_labels() {
        if let Some(window) = app.get_webview_window(label) {
            apply_platform_chrome(&window);
            if label == policy.main_label {
                let _ = window.show();
                let _ = window.set_focus();
            } else if label == policy.aux_label {
                let _ = window.hide();
            }
        }
    }
}

/// Show and focus the aux window without hiding it when already visible.
pub fn show_aux_window_with<R: Runtime>(
    app: &AppHandle<R>,
    policy: &WindowPolicy,
) -> Result<(), String> {
    let aux = app
        .get_webview_window(policy.aux_label)
        .ok_or_else(|| format!("Aux window `{}` is not configured", policy.aux_label))?;

    aux.show().map_err(|e| e.to_string())?;
    aux.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Show the aux window when hidden, otherwise hide it and refocus main.
pub fn toggle_aux_window_with<R: Runtime>(
    app: &AppHandle<R>,
    policy: &WindowPolicy,
) -> Result<(), String> {
    let aux = app
        .get_webview_window(policy.aux_label)
        .ok_or_else(|| format!("Aux window `{}` is not configured", policy.aux_label))?;

    let visible = aux.is_visible().map_err(|e| e.to_string())?;
    if visible {
        aux.hide().map_err(|e| e.to_string())?;
        if let Some(main) = app.get_webview_window(policy.main_label) {
            let _ = main.set_focus();
        }
        return Ok(());
    }

    aux.show().map_err(|e| e.to_string())?;
    aux.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Handle CloseRequested for main (prevent) and aux (hide + save state).
pub fn handle_window_event<R: Runtime>(
    window: &Window<R>,
    event: &WindowEvent,
    policy: &WindowPolicy,
) {
    let label = window.label();
    if label == policy.main_label {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // Frontend handles unsaved prompts via onCloseRequested.
            api.prevent_close();
        }
    } else if label == policy.aux_label {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.app_handle().save_window_state(WINDOW_STATE_FLAGS);
            let _ = window.hide();
        }
    }
}

/// When main is destroyed: save state, destroy aux, exit the process.
pub fn handle_run_event<R: Runtime>(
    app_handle: &AppHandle<R>,
    event: &RunEvent,
    policy: &WindowPolicy,
) {
    if let RunEvent::WindowEvent { label, event, .. } = event {
        if label.as_str() == policy.main_label {
            if let WindowEvent::Destroyed = event {
                let _ = app_handle.save_window_state(WINDOW_STATE_FLAGS);
                if let Some(aux) = app_handle.get_webview_window(policy.aux_label) {
                    let _ = aux.destroy();
                }
                app_handle.exit(0);
            }
        }
    }
}
