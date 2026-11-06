use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState(pub Mutex<Connection>);

pub fn init(app: &AppHandle) -> Result<DbState, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create app data dir {}: {e}", dir.display()))?;
    let path: PathBuf = dir.join("orbit.db");
    let conn = Connection::open(path).map_err(|e| format!("open sqlite: {e}"))?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS recent_workspaces (path TEXT PRIMARY KEY, name TEXT NOT NULL, opened_at INTEGER NOT NULL);
         CREATE TABLE IF NOT EXISTS session_state (id INTEGER PRIMARY KEY CHECK (id = 1), root TEXT, active_path TEXT, open_files TEXT NOT NULL DEFAULT '[]');
         CREATE TABLE IF NOT EXISTS receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, category TEXT NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL, detail TEXT, status TEXT NOT NULL, workspace TEXT, duration_ms INTEGER);
         CREATE INDEX IF NOT EXISTS idx_receipts_ts ON receipts(ts DESC);
         CREATE INDEX IF NOT EXISTS idx_receipts_cat ON receipts(category, ts DESC);
         CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, path TEXT NOT NULL, workspace TEXT, kind TEXT NOT NULL, bytes INTEGER NOT NULL, content TEXT NOT NULL);
         CREATE INDEX IF NOT EXISTS idx_snapshots_path ON snapshots(path, ts DESC);
         CREATE INDEX IF NOT EXISTS idx_snapshots_ws ON snapshots(workspace, ts DESC);
         CREATE TABLE IF NOT EXISTS capsules (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, workspace TEXT, data TEXT NOT NULL);
         CREATE INDEX IF NOT EXISTS idx_capsules_ws ON capsules(workspace, updated_at DESC);",
    ).map_err(|e| format!("sqlite init: {e}"))?;
    conn.execute("INSERT OR IGNORE INTO session_state (id, open_files) VALUES (1, '[]')", []).map_err(|e| e.to_string())?;
    Ok(DbState(Mutex::new(conn)))
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key=?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? { Ok(Some(row.get(0).map_err(|e| e.to_string())?)) } else { Ok(None) }
}
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute("INSERT INTO settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key, value]).map_err(|e| e.to_string())?;
    Ok(())
}
