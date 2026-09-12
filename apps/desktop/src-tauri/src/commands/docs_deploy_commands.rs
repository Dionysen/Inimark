//! Resolve the monorepo docs vault path (dev builds).

use std::path::PathBuf;

/// Absolute path to the monorepo `docs/` vault when running from source.
#[tauri::command]
pub fn resolve_inimark_docs_vault() -> Result<String, String> {
    if !cfg!(debug_assertions) {
        return Err("Docs vault resolution is only available in development builds.".into());
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // apps/desktop/src-tauri → repo root → docs
    let docs = manifest.join("../../../docs");
    let docs = docs
        .canonicalize()
        .map_err(|e| format!("Could not resolve docs vault at {}: {e}", docs.display()))?;
    let config = docs.join("publish.config.json");
    if !config.is_file() {
        return Err(format!(
            "Docs vault found but missing publish.config.json: {}",
            config.display()
        ));
    }
    Ok(docs.to_string_lossy().into_owned())
}
