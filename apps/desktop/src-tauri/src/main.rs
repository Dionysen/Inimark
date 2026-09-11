// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// Must live on the binary crate (this file), not only on lib.rs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    inimark_desktop_lib::run();
}
