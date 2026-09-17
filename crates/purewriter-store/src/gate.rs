use serde::{Deserialize, Serialize};

use crate::config::LibraryConfig;
use crate::schema::{known_schemas, SchemaFingerprint};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaStatus {
    pub fingerprint: SchemaFingerprint,
    pub known: bool,
    pub writes_allowed: bool,
    pub allow_write_on_mismatch: bool,
    pub expected: Vec<SchemaFingerprint>,
}

impl SchemaStatus {
    pub fn evaluate(fp: SchemaFingerprint, config: &LibraryConfig) -> Self {
        let known = config.is_fingerprint_accepted(&fp);
        let writes_allowed = config.writes_allowed(&fp);
        Self {
            fingerprint: fp,
            known,
            writes_allowed,
            allow_write_on_mismatch: config.schema_override.allow_write_on_mismatch,
            expected: {
                let mut v = known_schemas();
                for a in &config.schema_override.accepted_fingerprints {
                    let f = SchemaFingerprint::from(a);
                    if !v.contains(&f) {
                        v.push(f);
                    }
                }
                v
            },
        }
    }
}
