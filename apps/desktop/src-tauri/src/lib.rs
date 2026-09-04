// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, RunEvent, WindowEvent};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

const WINDOW_LABELS: &[&str] = &["main", "settings"];

fn finish_platform_window(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        let _ = window.set_shadow(true);
    }
}

fn apply_platform_chrome(window: &tauri::WebviewWindow) {
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
    finish_platform_window(window);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            for label in WINDOW_LABELS {
                if let Some(window) = app.get_webview_window(label) {
                    apply_platform_chrome(&window);
                    if *label == "settings" {
                        let _ = window.hide();
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| match window.label() {
            "main" => {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let app = window.app_handle();
                    if let Some(settings) = app.get_webview_window("settings") {
                        let _ = settings.destroy();
                    }
                    let _ = window.destroy();
                }
            }
            "settings" => {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::WindowEvent { label, event, .. } = event {
                if label == "main" && matches!(event, WindowEvent::Destroyed) {
                    // Exit only after webviews are destroyed (avoids WebView2 Error 1412).
                    app_handle.exit(0);
                }
            }
        });
}
