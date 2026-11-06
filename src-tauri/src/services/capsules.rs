use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use uuid::Uuid;
use crate::services::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleMeta { pub id: String, pub name: String, pub created_at: i64, pub updated_at: i64, pub workspace: Option<String> }
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Capsule { pub id: String, pub name: String, pub created_at: i64, pub updated_at: i64, pub workspace: Option<String>, pub data: Value }

fn now_ms() -> i64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0) }

#[tauri::command]
pub async fn capsule_save(state: State<'_, DbState>, id: Option<String>, name: String, workspace: Option<String>, data: Value) -> Result<CapsuleMeta, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let ts = now_ms();
    let created = conn.query_row("SELECT created_at FROM capsules WHERE id=?1", params![id], |r| r.get::<_, i64>(0)).unwrap_or(ts);
    let data_s = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO capsules(id,name,created_at,updated_at,workspace,data) VALUES(?1,?2,?3,?4,?5,?6)
                  ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at, workspace=excluded.workspace, data=excluded.data",
        params![id, name, created, ts, workspace, data_s]).map_err(|e| e.to_string())?;
    let _ = conn.execute("DELETE FROM capsules WHERE id NOT IN (SELECT id FROM capsules ORDER BY updated_at DESC LIMIT 200)", []);
    crate::services::receipts::record(&conn, "system", "capsule_save", &format!("Saved capsule: {}", conn.query_row("SELECT name FROM capsules WHERE id=?1", params![id], |r| r.get::<_,String>(0)).unwrap_or_else(|_| "capsule".into())), Some(&serde_json::json!({"id": id})), "ok", workspace.as_deref(), None);
    Ok(CapsuleMeta { id, name, created_at: created, updated_at: ts, workspace })
}

#[tauri::command]
pub async fn capsule_list(state: State<'_, DbState>, workspace: Option<String>, limit: Option<i64>) -> Result<Vec<CapsuleMeta>, String> {
    let limit = limit.unwrap_or(100).clamp(1, 500);
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut sql = "SELECT id,name,created_at,updated_at,workspace FROM capsules WHERE 1=1".to_string();
    let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(w) = workspace.filter(|s| !s.is_empty()) { sql.push_str(" AND workspace=?"); vals.push(Box::new(w)); }
    sql.push_str(" ORDER BY updated_at DESC LIMIT ?");
    vals.push(Box::new(limit));
    let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| Ok(CapsuleMeta { id: row.get(0)?, name: row.get(1)?, created_at: row.get(2)?, updated_at: row.get(3)?, workspace: row.get(4)? })).map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

#[tauri::command]
pub async fn capsule_get(state: State<'_, DbState>, id: String) -> Result<Capsule, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    conn.query_row("SELECT id,name,created_at,updated_at,workspace,data FROM capsules WHERE id=?1", params![id], |row| {
        let data_s: String = row.get(5)?;
        Ok(Capsule { id: row.get(0)?, name: row.get(1)?, created_at: row.get(2)?, updated_at: row.get(3)?, workspace: row.get(4)?, data: serde_json::from_str(&data_s).unwrap_or(Value::Null) })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn capsule_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    conn.execute("DELETE FROM capsules WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}
