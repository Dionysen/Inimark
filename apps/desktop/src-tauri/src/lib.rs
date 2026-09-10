// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

use commands::color_commands::pick_screen_color;
use commands::font_commands::list_system_fonts;
use commands::proxy_commands::get_system_proxy_url;
use commands::publish_commands::{
    publish_start_preview, publish_stop_preview, publish_write_site, SitePreviewState,
};
use commands::shell_commands::{open_url, open_with_default_app, reveal_in_file_manager};
use commands::update_commands::check_app_update;
use commands::window_commands::{show_settings_window, toggle_settings_window};

const WINDOW_LABELS: &[&str] = &["main", "settings"];

fn finish_platform_window(_window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        let _ = _window.set_shadow(true);
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(SitePreviewState::default())
        .invoke_handler(tauri::generate_handler![
            list_system_fonts,
            reveal_in_file_manager,
            open_with_default_app,
            open_url,
            get_system_proxy_url,
            check_app_update,
            pick_screen_color,
            show_settings_window,
            toggle_settings_window,
            publish_write_site,
            publish_start_preview,
            publish_stop_preview
        ])
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
                    // Frontend handles unsaved prompts via onCloseRequested.
                    api.prevent_close();
                }
            }
            "settings" => {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window
                        .app_handle()
                        .save_window_state(StateFlags::all());
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::WindowEvent { label, event, .. } = event {
                if label == "main" {
                    match event {
                        WindowEvent::CloseRequested { .. } => {}
                        WindowEvent::Destroyed => {
                            let _ = app_handle.save_window_state(StateFlags::all());
                            if let Some(settings) = app_handle.get_webview_window("settings") {
                                let _ = settings.destroy();
                            }
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                }
            }
        });
}
