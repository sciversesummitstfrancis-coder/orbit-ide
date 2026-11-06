use rusqlite::params;
use serde_json::{json, Value};
use tauri::State;
use crate::services::db::DbState;

#[tauri::command]
pub async fn hud_metrics(state: State<'_, DbState>, workspace: Option<String>) -> Result<Value, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let ws_filter = workspace.clone().filter(|s| !s.is_empty());
    let mut ai_sql = "SELECT ts, duration_ms, detail, status FROM receipts WHERE category='ai'".to_string();
    let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(w) = ws_filter.clone() { ai_sql.push_str(" AND workspace=?"); vals.push(Box::new(w)); }
    ai_sql.push_str(" ORDER BY ts DESC LIMIT 120");
    let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
    let mut ai = Vec::new();
    if let Ok(mut stmt) = conn.prepare(&ai_sql) {
        if let Ok(rows) = stmt.query_map(params.as_slice(), |row| {
            let detail_s: Option<String> = row.get(2)?;
            Ok(json!({"ts":row.get::<_,i64>(0)?,"duration_ms":row.get::<_,Option<i64>>(1)?,"status":row.get::<_,String>(3)?,"detail":detail_s.and_then(|s| serde_json::from_str::<Value>(&s).ok())}))
        }) { ai = rows.flatten().collect(); }
    }
    let mut cmd_sql = "SELECT category, AVG(COALESCE(duration_ms,0)), COUNT(*) FROM receipts WHERE duration_ms IS NOT NULL".to_string();
    let mut cvals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(w) = ws_filter.clone() { cmd_sql.push_str(" AND workspace=?"); cvals.push(Box::new(w)); }
    cmd_sql.push_str(" GROUP BY category ORDER BY COUNT(*) DESC");
    let cparams: Vec<&dyn rusqlite::types::ToSql> = cvals.iter().map(|v| v.as_ref()).collect();
    let mut cmd_stats = Vec::new();
    if let Ok(mut stmt) = conn.prepare(&cmd_sql) {
        if let Ok(rows) = stmt.query_map(cparams.as_slice(), |row| Ok(json!({"category":row.get::<_,String>(0)?,"avg_duration_ms":row.get::<_,f64>(1)?,"count":row.get::<_,i64>(2)?}))) { cmd_stats = rows.flatten().collect(); }
    }
    let counts: i64 = if let Some(w) = &ws_filter {
        conn.query_row("SELECT COUNT(*) FROM receipts WHERE workspace=?1", params![w], |r| r.get(0)).unwrap_or(0)
    } else {
        conn.query_row("SELECT COUNT(*) FROM receipts", [], |r| r.get(0)).unwrap_or(0)
    };
    let ai_avg = ai.iter().filter_map(|v| v.get("duration_ms").and_then(|d| d.as_i64())).collect::<Vec<_>>();
    let ai_avg_ms = if ai_avg.is_empty() { 0.0 } else { ai_avg.iter().sum::<i64>() as f64 / ai_avg.len() as f64 };
    Ok(json!({"workspace":workspace,"receipt_count":counts,"ai":{"samples":ai.len(),"avg_duration_ms":ai_avg_ms,"recent":ai.into_iter().take(30).collect::<Vec<_>>()},"command_duration_stats":cmd_stats,"scope":"Local metrics from receipts only (no cloud telemetry). Duration fields depend on instrumented actions."}))
}
