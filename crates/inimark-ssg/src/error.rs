use thiserror::Error;

pub type SsgResult<T> = Result<T, SsgError>;

#[derive(Debug, Error)]
pub enum SsgError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl SsgError {
    pub fn msg(msg: impl Into<String>) -> Self {
        Self::Message(msg.into())
    }
}
