mod commands;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

use commands::ai_commands::{ai_chat_cancel, ai_chat_stream, AiStreamState};
use commands::color_commands::pick_screen_color;
use commands::docs_deploy_commands::resolve_inimark_docs_vault;
use commands::font_commands::list_system_fonts;
use commands::proxy_commands::get_system_proxy_url;
use commands::publish_commands::{
    publish_start_preview, publish_stop_preview, publish_write_site, SitePreviewState,
};
use commands::shell_commands::{open_url, open_with_default_app, reveal_in_file_manager};
use commands::update_commands::check_app_update;
use commands::window_commands::{show_settings_window, toggle_settings_window};

const WINDOW_LABELS: &[&str] = &["main", "settings"];

/// Window geometry / maximize / fullscreen — not decorations or visibility.
/// Decorations are platform chrome (custom titlebar); visibility is applied
/// after chrome so Windows never flashes a transparent native title bar.
const WINDOW_STATE_FLAGS: StateFlags = StateFlags::from_bits_truncate(
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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(WINDOW_STATE_FLAGS)
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(SitePreviewState::default())
        .manage(AiStreamState::default())
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
            publish_stop_preview,
            resolve_inimark_docs_vault,
            ai_chat_stream,
            ai_chat_cancel
        ])
        .setup(|app| {
            for label in WINDOW_LABELS {
                if let Some(window) = app.get_webview_window(label) {
                    apply_platform_chrome(&window);
                    if *label == "main" {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else if *label == "settings" {
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
                        .save_window_state(WINDOW_STATE_FLAGS);
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
                            let _ = app_handle.save_window_state(WINDOW_STATE_FLAGS);
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
