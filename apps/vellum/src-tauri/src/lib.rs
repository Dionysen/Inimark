use tauri::Manager;

use dionysen_shell::{
    handle_run_event, handle_window_event, setup_dual_windows, WindowPolicy, WINDOW_STATE_FLAGS,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let window_policy = WindowPolicy::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(WINDOW_STATE_FLAGS)
                .build(),
        )
        .manage(window_policy)
        .invoke_handler(tauri::generate_handler![
            dionysen_shell::show_settings_window,
            dionysen_shell::toggle_settings_window,
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
