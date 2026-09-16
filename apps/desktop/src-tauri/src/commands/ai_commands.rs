use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::commands::proxy_commands::resolve_system_proxy_url;
use futures_util::StreamExt;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};
use url::Url;

pub struct AiStreamState {
    pub cancellations: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Default for AiStreamState {
    fn default() -> Self {
        Self {
            cancellations: Mutex::new(HashMap::new()),
        }
    }
}

/// Protocol-agnostic streaming POST: TS builds url / headers / body.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatStreamArgs {
    request_id: String,
    url: String,
    /// Extra request headers (Content-Type is always application/json).
    #[serde(default)]
    headers: HashMap<String, String>,
    body: serde_json::Value,
    use_system_proxy: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AiStreamPayload {
    request_id: String,
    kind: &'static str,
    payload: String,
}

fn clear_cancel(state: &AiStreamState, request_id: &str) {
    if let Ok(mut map) = state.cancellations.lock() {
        map.remove(request_id);
    }
}

fn emit_stream(app: &AppHandle, request_id: &str, kind: &'static str, payload: String) {
    let _ = app.emit(
        "ai-stream",
        AiStreamPayload {
            request_id: request_id.to_string(),
            kind,
            payload,
        },
    );
}

/// Stream an HTTP POST body; emits raw `chunk` / `done` / `error` via `ai-stream`.
#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    state: State<'_, AiStreamState>,
    args: AiChatStreamArgs,
) -> Result<(), String> {
    let url = args.url.trim();
    if url.is_empty() {
        return Err("url is empty".into());
    }

    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut map = state
            .cancellations
            .lock()
            .map_err(|_| "ai stream state poisoned".to_string())?;
        if let Some(prev) = map.insert(args.request_id.clone(), cancel.clone()) {
            prev.store(true, Ordering::SeqCst);
        }
    }

    let mut client_builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_secs(30));

    if args.use_system_proxy {
        if let Some(proxy) = resolve_system_proxy_url() {
            let proxy_url = Url::parse(&proxy).map_err(|e| e.to_string())?;
            client_builder =
                client_builder.proxy(reqwest::Proxy::all(proxy_url).map_err(|e| e.to_string())?);
        }
    } else {
        client_builder = client_builder.no_proxy();
    }

    let client = client_builder.build().map_err(|e| e.to_string())?;
    let request_id = args.request_id.clone();

    let mut request = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(&args.body);

    for (key, value) in &args.headers {
        if key.eq_ignore_ascii_case("content-type") {
            continue;
        }
        request = request.header(key.as_str(), value.as_str());
    }

    let response = match request.send().await {
        Ok(resp) => resp,
        Err(err) => {
            emit_stream(&app, &request_id, "error", err.to_string());
            clear_cancel(&state, &request_id);
            return Err(err.to_string());
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        let message = format!(
            "HTTP {status}: {}",
            text.chars().take(400).collect::<String>()
        );
        emit_stream(&app, &request_id, "error", message.clone());
        clear_cancel(&state, &request_id);
        return Err(message);
    }

    let mut stream = response.bytes_stream();

    while !cancel.load(Ordering::SeqCst) {
        let next = stream.next().await;
        let Some(item) = next else {
            break;
        };
        if cancel.load(Ordering::SeqCst) {
            break;
        }

        match item {
            Ok(bytes) => {
                let chunk = String::from_utf8_lossy(&bytes).to_string();
                if !chunk.is_empty() {
                    emit_stream(&app, &request_id, "chunk", chunk);
                }
            }
            Err(err) => {
                emit_stream(&app, &request_id, "error", err.to_string());
                break;
            }
        }
    }

    emit_stream(&app, &request_id, "done", String::new());
    clear_cancel(&state, &request_id);
    Ok(())
}

#[tauri::command]
pub fn ai_chat_cancel(state: State<'_, AiStreamState>, request_id: String) -> Result<(), String> {
    let mut map = state
        .cancellations
        .lock()
        .map_err(|_| "ai stream state poisoned".to_string())?;
    if let Some(flag) = map.remove(&request_id) {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}
