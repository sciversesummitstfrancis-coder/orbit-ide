use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::services::db::DbState;

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentWorkspace { pub path: String, pub name: String, pub opened_at: i64 }
#[derive(Serialize, Deserialize, Clone)]
pub struct SessionState { pub root: Option<String>, pub active_path: Option<String>, pub open_files: Vec<String> }

#[tauri::command]
pub async fn workspace_add_recent(state: State<'_, DbState>, path: String) -> Result<(), String> {
    let name = std::path::Path::new(&path).file_name().and_then(|s| s.to_str()).unwrap_or(&path).to_string();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs() as i64;
    let conn = state.0.lock().map_err(|_| "db lock")?;
    conn.execute("INSERT INTO recent_workspaces(path,name,opened_at) VALUES(?1,?2,?3) ON CONFLICT(path) DO UPDATE SET name=excluded.name, opened_at=excluded.opened_at", params![path, name, now]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM recent_workspaces WHERE path NOT IN (SELECT path FROM recent_workspaces ORDER BY opened_at DESC LIMIT 30)", []).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn workspace_list_recent(state: State<'_, DbState>) -> Result<Vec<RecentWorkspace>, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut stmt = conn.prepare("SELECT path,name,opened_at FROM recent_workspaces ORDER BY opened_at DESC LIMIT 30").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(RecentWorkspace { path: row.get(0)?, name: row.get(1)?, opened_at: row.get(2)? })).map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

#[tauri::command]
#[allow(dead_code)] // referenced via tauri::generate_handler
pub async fn workspace_remove_recent(state: State<'_, DbState>, path: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    conn.execute("DELETE FROM recent_workspaces WHERE path=?1", params![path]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn session_save(state: State<'_, DbState>, session: SessionState) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let open_files = serde_json::to_string(&session.open_files).map_err(|e| e.to_string())?;
    conn.execute("UPDATE session_state SET root=?1, active_path=?2, open_files=?3 WHERE id=1", params![session.root, session.active_path, open_files]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn session_restore(state: State<'_, DbState>) -> Result<SessionState, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut stmt = conn.prepare("SELECT root, active_path, open_files FROM session_state WHERE id=1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let root: Option<String> = row.get(0).map_err(|e| e.to_string())?;
        let active_path: Option<String> = row.get(1).map_err(|e| e.to_string())?;
        let open_files_s: String = row.get(2).map_err(|e| e.to_string())?;
        let open_files = serde_json::from_str(&open_files_s).unwrap_or_default();
        Ok(SessionState { root, active_path, open_files })
    } else { Ok(SessionState { root: None, active_path: None, open_files: vec![] }) }
}
