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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatStreamArgs {
    request_id: String,
    base_url: String,
    api_key: String,
    model: String,
    messages: serde_json::Value,
    tools: Option<serde_json::Value>,
    use_system_proxy: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AiStreamPayload {
    request_id: String,
    kind: &'static str,
    payload: String,
}

fn join_chat_url(base_url: &str) -> Result<String, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("baseUrl is empty".into());
    }
    if trimmed.ends_with("/chat/completions") {
        return Ok(trimmed.to_string());
    }
    Ok(format!("{trimmed}/chat/completions"))
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

/// Stream an OpenAI-compatible chat completion; emits `ai-stream` events.
#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    state: State<'_, AiStreamState>,
    args: AiChatStreamArgs,
) -> Result<(), String> {
    let url = join_chat_url(&args.base_url)?;
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

    let mut body = serde_json::json!({
        "model": args.model,
        "messages": args.messages,
        "stream": true,
    });
    if let Some(tools) = args.tools {
        body["tools"] = tools;
        body["tool_choice"] = serde_json::json!("auto");
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

    let response = match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", args.api_key))
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(&body)
        .send()
        .await
    {
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
    let mut buffer = String::new();

    while !cancel.load(Ordering::SeqCst) {
        let next = stream.next().await;
        let Some(item) = next else {
            break;
        };
        if cancel.load(Ordering::SeqCst) {
            break;
        }

        let chunk = match item {
            Ok(bytes) => bytes,
            Err(err) => {
                emit_stream(&app, &request_id, "error", err.to_string());
                break;
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));
        let mut done = false;
        while let Some(idx) = buffer.find('\n') {
            let mut line = buffer[..idx].to_string();
            buffer = buffer[idx + 1..].to_string();
            if line.ends_with('\r') {
                line.pop();
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Some(data) = trimmed.strip_prefix("data:") {
                let payload = data.trim();
                if payload == "[DONE]" {
                    done = true;
                    break;
                }
                emit_stream(&app, &request_id, "data", payload.to_string());
            }
        }
        if done {
            break;
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
