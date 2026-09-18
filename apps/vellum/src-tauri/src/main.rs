// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if vellum_app_lib::run_cloud_backup_worker() {
        return;
    }
    vellum_app_lib::run();
}
