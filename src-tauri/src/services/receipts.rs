use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
use crate::services::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Receipt {
    pub id: i64,
    pub ts: i64,
    pub category: String,
    pub action: String,
    pub summary: String,
    pub detail: Option<Value>,
    pub status: String,
    pub workspace: Option<String>,
    pub duration_ms: Option<i64>,
}

pub fn record(
    conn: &Connection,
    category: &str,
    action: &str,
    summary: &str,
    detail: Option<&Value>,
    status: &str,
    workspace: Option<&str>,
    duration_ms: Option<i64>,
) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let detail_s = detail.map(|v| v.to_string());
    let _ = conn.execute(
        "INSERT INTO receipts(ts,category,action,summary,detail,status,workspace,duration_ms) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
        params![ts, category, action, summary, detail_s, status, workspace, duration_ms],
    );
    // keep last 2000 receipts
    let _ = conn.execute(
        "DELETE FROM receipts WHERE id NOT IN (SELECT id FROM receipts ORDER BY ts DESC, id DESC LIMIT 2000)",
        [],
    );
}

pub fn try_record(
    db: &DbState,
    category: &str,
    action: &str,
    summary: &str,
    detail: Option<&Value>,
    status: &str,
    workspace: Option<&str>,
    duration_ms: Option<i64>,
) {
    if let Ok(conn) = db.0.lock() {
        record(&conn, category, action, summary, detail, status, workspace, duration_ms);
    }
}

#[derive(Deserialize)]
pub struct ReceiptsQuery {
    pub limit: Option<i64>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub workspace: Option<String>,
}

#[tauri::command]
pub async fn receipts_list(state: State<'_, DbState>, query: Option<ReceiptsQuery>) -> Result<Vec<Receipt>, String> {
    let q = query.unwrap_or(ReceiptsQuery { limit: None, category: None, search: None, workspace: None });
    let limit = q.limit.unwrap_or(200).clamp(1, 1000);
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut sql = "SELECT id,ts,category,action,summary,detail,status,workspace,duration_ms FROM receipts WHERE 1=1".to_string();
    let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(c) = q.category.filter(|s| !s.trim().is_empty()) { sql.push_str(" AND category=?"); vals.push(Box::new(c)); }
    if let Some(w) = q.workspace.filter(|s| !s.trim().is_empty()) { sql.push_str(" AND workspace=?"); vals.push(Box::new(w)); }
    if let Some(s) = q.search.filter(|s| !s.trim().is_empty()) {
        sql.push_str(" AND (summary LIKE ? OR action LIKE ? OR category LIKE ? OR COALESCE(detail,'') LIKE ?)");
        let like = format!("%{}%", s);
        vals.push(Box::new(like.clone())); vals.push(Box::new(like.clone())); vals.push(Box::new(like.clone())); vals.push(Box::new(like));
    }
    sql.push_str(" ORDER BY ts DESC, id DESC LIMIT ?");
    vals.push(Box::new(limit));
    let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| {
        let detail_s: Option<String> = row.get(5)?;
        Ok(Receipt {
            id: row.get(0)?, ts: row.get(1)?, category: row.get(2)?, action: row.get(3)?,
            summary: row.get(4)?, detail: detail_s.and_then(|s| serde_json::from_str(&s).ok()),
            status: row.get(6)?, workspace: row.get(7)?, duration_ms: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

#[tauri::command]
pub async fn receipts_clear(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    conn.execute("DELETE FROM receipts", []).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn receipts_summary(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut stmt = conn.prepare("SELECT category, status, COUNT(*) FROM receipts GROUP BY category, status ORDER BY category, status").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(json!({"category": row.get::<_,String>(0)?, "status": row.get::<_,String>(1)?, "count": row.get::<_,i64>(2)?}))).map_err(|e| e.to_string())?;
    Ok(Value::Array(rows.flatten().collect()))
}
