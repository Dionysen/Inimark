//! Pure Writer local store — Room.db + PWB with schema gate and write conventions.

mod config;
mod error;
mod gate;
mod ids;
mod library;
mod lock;
mod models;
mod order_key;
mod pwb;
mod repo;
mod schema;
mod sidecar;
mod time;
mod util;

pub use config::{LibraryConfig, SchemaOverride};
pub use error::{Error, Result};
pub use gate::SchemaStatus;
pub use library::Library;
pub use models::*;
pub use pwb::{export_pwb, unpack_pwb, UnpackedPwb};
pub use schema::{baseline_fingerprint, known_schemas, SchemaFingerprint};
pub use sidecar::ScrollEntry;
