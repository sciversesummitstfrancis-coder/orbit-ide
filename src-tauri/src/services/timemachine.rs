use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::services::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SnapshotMeta { pub id: i64, pub ts: i64, pub path: String, pub workspace: Option<String>, pub kind: String, pub bytes: i64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Snapshot { pub id: i64, pub ts: i64, pub path: String, pub workspace: Option<String>, pub kind: String, pub bytes: i64, pub content: String }

fn now_ms() -> i64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0) }

pub fn record_snapshot(conn: &rusqlite::Connection, path: &str, workspace: Option<&str>, kind: &str, content: &str) {
    let ts = now_ms();
    let bytes = content.len() as i64;
    // skip duplicate consecutive save for same path/content size heuristic? keep simple but avoid exact duplicate latest content for same kind+path
    if let Ok(mut stmt) = conn.prepare("SELECT content, kind FROM snapshots WHERE path=?1 ORDER BY ts DESC, id DESC LIMIT 1") {
        if let Ok(mut rows) = stmt.query(params![path]) {
            if let Ok(Some(row)) = rows.next() {
                let prev: String = row.get(0).unwrap_or_default();
                let prev_kind: String = row.get(1).unwrap_or_default();
                if prev == content && (prev_kind == kind || kind == "save") { return; }
            }
        }
    }
    let _ = conn.execute("INSERT INTO snapshots(ts,path,workspace,kind,bytes,content) VALUES(?1,?2,?3,?4,?5,?6)", params![ts, path, workspace, kind, bytes, content]);
    let _ = conn.execute("DELETE FROM snapshots WHERE path=?1 AND id NOT IN (SELECT id FROM snapshots WHERE path=?1 ORDER BY ts DESC, id DESC LIMIT 40)", params![path]);
    let _ = conn.execute("DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY ts DESC, id DESC LIMIT 1500)", []);
}

pub fn try_record_snapshot(db: &DbState, path: &str, workspace: Option<&str>, kind: &str, content: &str) {
    if let Ok(conn) = db.0.lock() { record_snapshot(&conn, path, workspace, kind, content); }
}

#[tauri::command]
pub async fn tm_list(state: State<'_, DbState>, path: Option<String>, workspace: Option<String>, limit: Option<i64>) -> Result<Vec<SnapshotMeta>, String> {
    let limit = limit.unwrap_or(80).clamp(1, 500);
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut sql = "SELECT id,ts,path,workspace,kind,bytes FROM snapshots WHERE 1=1".to_string();
    let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(p) = path.filter(|s| !s.is_empty()) { sql.push_str(" AND path=?"); vals.push(Box::new(p)); }
    if let Some(w) = workspace.filter(|s| !s.is_empty()) { sql.push_str(" AND workspace=?"); vals.push(Box::new(w)); }
    sql.push_str(" ORDER BY ts DESC, id DESC LIMIT ?");
    vals.push(Box::new(limit));
    let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| Ok(SnapshotMeta { id: row.get(0)?, ts: row.get(1)?, path: row.get(2)?, workspace: row.get(3)?, kind: row.get(4)?, bytes: row.get(5)? })).map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

#[tauri::command]
pub async fn tm_get(state: State<'_, DbState>, id: i64) -> Result<Snapshot, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    conn.query_row("SELECT id,ts,path,workspace,kind,bytes,content FROM snapshots WHERE id=?1", params![id], |row| {
        Ok(Snapshot { id: row.get(0)?, ts: row.get(1)?, path: row.get(2)?, workspace: row.get(3)?, kind: row.get(4)?, bytes: row.get(5)?, content: row.get(6)? })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tm_capture(state: State<'_, DbState>, path: String, workspace: Option<String>, kind: Option<String>, content: String) -> Result<(), String> {
    let kind = kind.unwrap_or_else(|| "draft".into());
    let conn = state.0.lock().map_err(|_| "db lock")?;
    record_snapshot(&conn, &path, workspace.as_deref(), &kind, &content);
    Ok(())
}

#[tauri::command]
pub async fn tm_latest_dirty(state: State<'_, DbState>, workspace: Option<String>) -> Result<Vec<SnapshotMeta>, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    // latest draft/crash snapshot per path
    let mut sql = "SELECT s.id,s.ts,s.path,s.workspace,s.kind,s.bytes FROM snapshots s JOIN (SELECT path, MAX(ts) mts FROM snapshots WHERE kind IN ('draft','crash')".to_string();
    let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(w) = workspace.filter(|s| !s.is_empty()) { sql.push_str(" AND workspace=?"); vals.push(Box::new(w)); }
    sql.push_str(" GROUP BY path) m ON s.path=m.path AND s.ts=m.mts ORDER BY s.ts DESC LIMIT 100");
    let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| Ok(SnapshotMeta { id: row.get(0)?, ts: row.get(1)?, path: row.get(2)?, workspace: row.get(3)?, kind: row.get(4)?, bytes: row.get(5)? })).map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

#[tauri::command]
pub async fn tm_delete(state: State<'_, DbState>, id: Option<i64>, path: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    if let Some(id) = id { conn.execute("DELETE FROM snapshots WHERE id=?1", params![id]).map_err(|e| e.to_string())?; }
    else if let Some(path) = path { conn.execute("DELETE FROM snapshots WHERE path=?1", params![path]).map_err(|e| e.to_string())?; }
    else { conn.execute("DELETE FROM snapshots", []).map_err(|e| e.to_string())?; }
    Ok(())
}
