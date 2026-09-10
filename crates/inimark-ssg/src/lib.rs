//! Inimark static-site generator support: write prepared artifacts and preview.

mod error;
mod preview;
mod write;

pub use error::{SsgError, SsgResult};
pub use preview::{PreviewHandle, PreviewServer, start_preview, stop_preview};
pub use write::{MediaCopy, SiteFile, WriteSiteRequest, write_site};
