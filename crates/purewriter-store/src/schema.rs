use serde::{Deserialize, Serialize};

/// Known Room schema fingerprint (PRAGMA user_version + room identity_hash).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaFingerprint {
    pub user_version: i32,
    pub identity_hash: String,
}

impl SchemaFingerprint {
    pub fn display(&self) -> String {
        format!("{}:{}", self.user_version, self.identity_hash)
    }
}

/// Baseline fingerprint for the schema this crate was built against (Pure Writer Room v27).
pub fn baseline_fingerprint() -> SchemaFingerprint {
    SchemaFingerprint {
        user_version: 27,
        identity_hash: "af22c7c534a04acc4530d670ac9e43c4".into(),
    }
}

/// Built-in accepted schemas (first release: v27 only).
pub fn known_schemas() -> Vec<SchemaFingerprint> {
    vec![baseline_fingerprint()]
}
