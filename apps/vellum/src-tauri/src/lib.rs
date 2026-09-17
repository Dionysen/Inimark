use tauri::Manager;

use dionysen_cloud_sync::CloudSyncState;
use dionysen_shell::{
    handle_run_event, handle_window_event, setup_dual_windows, WindowPolicy, WINDOW_STATE_FLAGS,
};

mod pw_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let window_policy = WindowPolicy::default();

    let mut builder = tauri::Builder::default();

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
    }

    builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(WINDOW_STATE_FLAGS)
                .with_filter(|label| label != "oauth-login")
                .build(),
        )
        .manage(window_policy)
        .manage(pw_commands::PwState::default())
        .manage(CloudSyncState::new().unwrap_or_else(|e| {
            panic!("failed to open cloud-sync vault: {e}");
        }))
        .invoke_handler(tauri::generate_handler![
            dionysen_shell::show_settings_window,
            dionysen_shell::toggle_settings_window,
            pw_commands::pw_open,
            pw_commands::pw_close,
            pw_commands::pw_schema_status,
            pw_commands::pw_list_folders,
            pw_commands::pw_list_categories,
            pw_commands::pw_list_articles,
            pw_commands::pw_get_article,
            pw_commands::pw_create_folder,
            pw_commands::pw_create_category,
            pw_commands::pw_create_article,
            pw_commands::pw_update_article,
            pw_commands::pw_trash_article,
            pw_commands::pw_list_settings,
            pw_commands::pw_set_setting,
            pw_commands::pw_pwb_export,
            pw_commands::pw_pwb_import,
            dionysen_cloud_sync::commands::cs_begin_oauth,
            dionysen_cloud_sync::commands::cs_complete_oauth,
            dionysen_cloud_sync::commands::cs_get_session,
            dionysen_cloud_sync::commands::cs_get_profile,
            dionysen_cloud_sync::commands::cs_logout,
            dionysen_cloud_sync::commands::cs_list_siblings,
            dionysen_cloud_sync::commands::cs_adopt_session,
            dionysen_cloud_sync::commands::cs_configure_oss,
            dionysen_cloud_sync::commands::cs_oss_list,
            dionysen_cloud_sync::commands::cs_oss_get,
            dionysen_cloud_sync::commands::cs_oss_put,
            dionysen_cloud_sync::commands::cs_oss_delete,
            dionysen_cloud_sync::commands::cs_oss_head,
            dionysen_cloud_sync::commands::cs_open_url,
            dionysen_cloud_sync::commands::cs_open_oauth_login,
            dionysen_cloud_sync::commands::cs_ensure_access_token,
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
