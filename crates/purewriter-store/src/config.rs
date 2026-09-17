use serde::{Deserialize, Serialize};

use crate::schema::{known_schemas, SchemaFingerprint};

/// Contents of `App/.vellum-purewriter.json`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryConfig {
    #[serde(default)]
    pub schema_override: SchemaOverride,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaOverride {
    /// When true, allow writes even if fingerprint is unknown.
    #[serde(default)]
    pub allow_write_on_mismatch: bool,
    /// Extra fingerprints the user manually accepts.
    #[serde(default)]
    pub accepted_fingerprints: Vec<AcceptedFingerprint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptedFingerprint {
    pub user_version: i32,
    pub identity_hash: String,
}

impl From<&AcceptedFingerprint> for SchemaFingerprint {
    fn from(a: &AcceptedFingerprint) -> Self {
        SchemaFingerprint {
            user_version: a.user_version,
            identity_hash: a.identity_hash.clone(),
        }
    }
}

impl LibraryConfig {
    pub fn load(path: &std::path::Path) -> crate::Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let text = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&text)?)
    }

    pub fn is_fingerprint_accepted(&self, fp: &SchemaFingerprint) -> bool {
        known_schemas().iter().any(|k| k == fp)
            || self
                .schema_override
                .accepted_fingerprints
                .iter()
                .any(|a| a.user_version == fp.user_version && a.identity_hash == fp.identity_hash)
    }

    pub fn writes_allowed(&self, fp: &SchemaFingerprint) -> bool {
        self.is_fingerprint_accepted(fp) || self.schema_override.allow_write_on_mismatch
    }
}
