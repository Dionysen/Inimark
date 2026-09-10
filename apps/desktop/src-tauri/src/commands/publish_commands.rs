use std::path::PathBuf;
use std::sync::Mutex;

use inimark_ssg::{
    start_preview, stop_preview, write_site, PreviewServer, WriteSiteRequest,
};
use tauri::State;

#[derive(Default)]
pub struct SitePreviewState(pub Mutex<PreviewServer>);

#[tauri::command]
pub fn publish_write_site(request: WriteSiteRequest) -> Result<String, String> {
    write_site(&request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn publish_start_preview(
    dir: String,
    state: State<'_, SitePreviewState>,
) -> Result<String, String> {
    let path = PathBuf::from(&dir);
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        stop_preview(&mut guard);
    }
    let handle = start_preview(path).await.map_err(|e| e.to_string())?;
    let url = handle.url.clone();
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let _ = guard.replace(handle);
    Ok(url)
}

#[tauri::command]
pub fn publish_stop_preview(state: State<'_, SitePreviewState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    stop_preview(&mut guard);
    Ok(())
}
