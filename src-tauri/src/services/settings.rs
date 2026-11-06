use serde_json::Value;
use tauri::State;
use crate::services::db::{self, DbState};

#[tauri::command]
pub async fn settings_get(state: State<'_, DbState>, key: Option<String>) -> Result<Value, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    if let Some(key) = key {
        let v = db::get_setting(&conn, &key)?;
        return Ok(v.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(Value::Null));
    }
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    let mut map = serde_json::Map::new();
    for r in rows.flatten() { map.insert(r.0, serde_json::from_str(&r.1).unwrap_or(Value::String(r.1))); }
    Ok(Value::Object(map))
}

#[tauri::command]
pub async fn settings_set(state: State<'_, DbState>, key: String, value: Value) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    db::set_setting(&conn, &key, &serde_json::to_string(&value).map_err(|e| e.to_string())?)
}
