use std::time::Duration;

use crate::commands::proxy_commands::resolve_system_proxy_url;
use semver::Version;
use serde::Serialize;
use tauri::{Manager, ResourceId, Runtime, Webview};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

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

/// Check for app updates with explicit system-proxy control for the updater only.
#[tauri::command]
pub async fn check_app_update<R: Runtime>(
    webview: Webview<R>,
    use_system_proxy: bool,
    timeout_ms: Option<u64>,
    dev_current_version_override: Option<String>,
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

    if let Some(override_raw) = dev_current_version_override {
        let trimmed = override_raw.trim();
        if !trimmed.is_empty() {
            let override_version = Version::parse(trimmed).map_err(|error| {
                format!("Invalid dev current version override: {error}")
            })?;
            builder = builder.version_comparator(move |_current, release| {
                release.version > override_version
            });
        }
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
