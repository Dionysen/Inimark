use fontdb::Database;
use serde::Serialize;
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontInfo {
    /// CSS font-family name
    pub family: String,
    /// Whether any face in the family is monospaced
    pub monospaced: bool,
}

/// List installed system fonts (deduped by family, sorted).
#[tauri::command]
pub fn list_system_fonts() -> Vec<SystemFontInfo> {
    let mut db = Database::new();
    db.load_system_fonts();

    let mut seen: HashSet<String> = HashSet::new();
    let mut fonts: Vec<SystemFontInfo> = Vec::new();

    for face in db.faces() {
        let Some((name, _)) = face.families.first() else {
            continue;
        };
        if name.is_empty() || name.starts_with('.') {
            continue;
        }
        if !seen.insert(name.clone()) {
            if face.monospaced {
                if let Some(existing) = fonts.iter_mut().find(|f| f.family == *name) {
                    existing.monospaced = true;
                }
            }
            continue;
        }
        fonts.push(SystemFontInfo {
            family: name.clone(),
            monospaced: face.monospaced,
        });
    }

    fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
    fonts
}
