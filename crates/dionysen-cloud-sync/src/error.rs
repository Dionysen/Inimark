use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
    #[error("{0}")]
    Message(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("http: {0}")]
    Http(String),
    #[error("crypto: {0}")]
    Crypto(String),
    #[error("oauth: {0}")]
    Oauth(String),
    #[error("oss: {0}")]
    Oss(String),
}

impl Error {
    pub fn msg(s: impl Into<String>) -> Self {
        Self::Message(s.into())
    }
}

impl From<Error> for String {
    fn from(value: Error) -> Self {
        value.to_string()
    }
}
