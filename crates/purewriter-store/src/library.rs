use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::config::LibraryConfig;
use crate::error::{Error, Result};
use crate::gate::SchemaStatus;
use crate::lock::LibraryLock;
use crate::schema::SchemaFingerprint;

const CONFIG_NAME: &str = ".vellum-purewriter.json";
const ROOM_DB: &str = "Room.db";

/// Open Pure Writer library (folder containing `App/Room.db`).
pub struct Library {
    root: PathBuf,
    app_dir: PathBuf,
    conn: Connection,
    config: LibraryConfig,
    schema: SchemaStatus,
    _lock: LibraryLock,
}

impl Library {
    /// Open library for read+write when schema allows; otherwise read-only mode.
    pub fn open(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref().canonicalize().unwrap_or_else(|_| root.as_ref().to_path_buf());
        let app_dir = root.join("App");
        let room = app_dir.join(ROOM_DB);
        if !room.is_file() {
            return Err(Error::NotALibrary(root.display().to_string()));
        }

        let lock = LibraryLock::acquire(&app_dir)?;
        let config = LibraryConfig::load(&app_dir.join(CONFIG_NAME))?;

        let conn = Connection::open(&room)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.execute_batch("PRAGMA foreign_keys = OFF;")?;

        let fingerprint = read_fingerprint(&conn)?;
        let schema = SchemaStatus::evaluate(fingerprint, &config);

        Ok(Self {
            root,
            app_dir,
            conn,
            config,
            schema,
            _lock: lock,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn app_dir(&self) -> &Path {
        &self.app_dir
    }

    pub fn room_db_path(&self) -> PathBuf {
        self.app_dir.join(ROOM_DB)
    }

    pub fn schema_status(&self) -> &SchemaStatus {
        &self.schema
    }

    pub fn config(&self) -> &LibraryConfig {
        &self.config
    }

    pub fn writes_allowed(&self) -> bool {
        self.schema.writes_allowed
    }

    pub(crate) fn ensure_writable(&self) -> Result<()> {
        if self.schema.writes_allowed {
            Ok(())
        } else {
            Err(Error::ReadOnlySchema)
        }
    }

    pub(crate) fn conn(&self) -> &Connection {
        &self.conn
    }
}

fn read_fingerprint(conn: &Connection) -> Result<SchemaFingerprint> {
    let user_version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let identity_hash: String = conn
        .query_row(
            "SELECT identity_hash FROM room_master_table WHERE id = 42",
            [],
            |r| r.get(0),
        )
        .unwrap_or_default();
    Ok(SchemaFingerprint {
        user_version,
        identity_hash,
    })
}
