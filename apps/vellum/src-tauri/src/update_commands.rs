//! Updater check that honors the About-page "use system proxy" switch.
//!
//! The plugin's default client follows the process environment. This command
//! builds its own client so the toggle can force a proxy or bypass one.

use std::time::Duration;

use serde::Serialize;
use tauri::{Manager, ResourceId, Runtime, Webview};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

use crate::proxy::resolve_system_proxy_url;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    rid: ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

/// Check the Vellum update channel.
///
/// `use_system_proxy` applies only to this request. `timeout_ms` caps the
/// endpoint fetch so a dead proxy cannot hang the About page.
#[tauri::command]
pub async fn check_app_update<R: Runtime>(
    webview: Webview<R>,
    use_system_proxy: bool,
    timeout_ms: Option<u64>,
) -> Result<Option<UpdateMetadata>, String> {
    let mut builder = webview.updater_builder();

    if let Some(timeout_ms) = timeout_ms {
        builder = builder.timeout(Duration::from_millis(timeout_ms));
    }

    if use_system_proxy {
        if let Some(proxy) = resolve_system_proxy_url() {
            let url = Url::parse(&proxy).map_err(|error| error.to_string())?;
            builder = builder.proxy(url);
        }
    } else {
        builder = builder.no_proxy();
    }

    let updater = builder.build().map_err(|error| error.to_string())?;
    let update = updater.check().await.map_err(|error| error.to_string())?;

    let Some(update) = update else {
        return Ok(None);
    };

    let formatted_date = update.date.and_then(|date| {
        date.format(&time::format_description::well_known::Rfc3339)
            .ok()
    });

    let metadata = UpdateMetadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date: formatted_date,
        body: update.body.clone(),
        raw_json: update.raw_json.clone(),
        rid: webview.resources_table().add(update),
    };

    Ok(Some(metadata))
}
