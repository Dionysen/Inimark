use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
    #[error("not a Pure Writer library root (missing App/Room.db): {0}")]
    NotALibrary(String),

    #[error("schema mismatch: found {found}, expected one of {expected:?}")]
    SchemaMismatch {
        found: String,
        expected: Vec<String>,
    },

    #[error("library is read-only due to schema mismatch; edit App/.vellum-purewriter.json to override")]
    ReadOnlySchema,

    #[error("library already locked by another process: {0}")]
    Locked(String),

    #[error("library is not open")]
    NotOpen,

    #[error("entity not found: {0}")]
    NotFound(String),

    #[error("invalid pwb: {0}")]
    InvalidPwb(String),

    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("{0}")]
    Other(String),
}

impl Error {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotALibrary(_) => "not_a_library",
            Self::SchemaMismatch { .. } => "schema_mismatch",
            Self::ReadOnlySchema => "read_only_schema",
            Self::Locked(_) => "locked",
            Self::NotOpen => "not_open",
            Self::NotFound(_) => "not_found",
            Self::InvalidPwb(_) => "invalid_pwb",
            Self::Sqlite(_) => "sqlite",
            Self::Io(_) => "io",
            Self::Json(_) => "json",
            Self::Other(_) => "other",
        }
    }
}
