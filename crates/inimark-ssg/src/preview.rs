use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use tokio::sync::oneshot;
use tower_http::services::ServeDir;

use crate::error::{SsgError, SsgResult};

/// Running preview server handle (stop by dropping or calling [`stop_preview`]).
pub struct PreviewHandle {
    pub port: u16,
    pub url: String,
    shutdown: Option<oneshot::Sender<()>>,
}

impl PreviewHandle {
    pub fn stop(mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
    }
}

impl Drop for PreviewHandle {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
    }
}

/// Process-global preview slot used by the Tauri command layer.
#[derive(Default)]
pub struct PreviewServer {
    inner: Option<PreviewHandle>,
}

impl PreviewServer {
    pub fn take(&mut self) -> Option<PreviewHandle> {
        self.inner.take()
    }

    pub fn replace(&mut self, handle: PreviewHandle) -> Option<PreviewHandle> {
        self.inner.replace(handle)
    }

    pub fn url(&self) -> Option<&str> {
        self.inner.as_ref().map(|h| h.url.as_str())
    }
}

/// Start a static-file HTTP server for `dir`. Picks an ephemeral port on localhost.
pub async fn start_preview(dir: PathBuf) -> SsgResult<PreviewHandle> {
    if !dir.is_dir() {
        return Err(SsgError::msg(format!(
            "preview directory does not exist: {}",
            dir.display()
        )));
    }

    let service = ServeDir::new(dir).append_index_html_on_directories(true);
    let app = Router::new().fallback_service(service);

    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .map_err(|e| SsgError::msg(format!("bind preview server failed: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| SsgError::msg(format!("preview local_addr failed: {e}")))?
        .port();
    let url = format!("http://127.0.0.1:{port}/");

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let server = axum::serve(listener, app).with_graceful_shutdown(async move {
        let _ = shutdown_rx.await;
    });

    tokio::spawn(async move {
        let _ = server.await;
    });

    Ok(PreviewHandle {
        port,
        url,
        shutdown: Some(shutdown_tx),
    })
}

pub fn stop_preview(server: &mut PreviewServer) {
    if let Some(handle) = server.take() {
        handle.stop();
    }
}
