mod commands;

use tauri::Manager;

use commands::ai_commands::{ai_chat_cancel, ai_chat_stream, AiStreamState};
use commands::color_commands::pick_screen_color;
use commands::docs_deploy_commands::resolve_inimark_docs_vault;
use commands::proxy_commands::get_system_proxy_url;
use commands::publish_commands::{
    publish_start_preview, publish_stop_preview, publish_write_site, SitePreviewState,
};
use commands::shell_commands::{open_url, open_with_default_app, reveal_in_file_manager};
use commands::update_commands::check_app_update;
use dionysen_shell::{
    handle_run_event, handle_window_event, setup_dual_windows, WindowPolicy, WINDOW_STATE_FLAGS,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let window_policy = WindowPolicy::default();

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
        .manage(window_policy)
        .invoke_handler(tauri::generate_handler![
            dionysen_shell::list_system_fonts,
            reveal_in_file_manager,
            open_with_default_app,
            open_url,
            get_system_proxy_url,
            check_app_update,
            pick_screen_color,
            dionysen_shell::show_settings_window,
            dionysen_shell::toggle_settings_window,
            publish_write_site,
            publish_start_preview,
            publish_stop_preview,
            resolve_inimark_docs_vault,
            ai_chat_stream,
            ai_chat_cancel
        ])
        .setup(|app| {
            let policy = app.state::<WindowPolicy>();
            setup_dual_windows(app, &policy);
            Ok(())
        })
        .on_window_event(|window, event| {
            let policy = window.app_handle().state::<WindowPolicy>();
            handle_window_event(window, event, &policy);
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            let policy = app_handle.state::<WindowPolicy>();
            handle_run_event(app_handle, &event, &policy);
        });
}
