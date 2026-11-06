use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
use crate::services::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Incident {
    pub id: String,
    pub ts: i64,
    pub kind: String,
    pub severity: String,
    pub title: String,
    pub summary: String,
    pub workspace: Option<String>,
    pub evidence: Vec<Value>,
    pub suggested_actions: Vec<String>,
}

fn now_ms() -> i64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0) }

#[derive(Deserialize)]
pub struct MissionQuery { pub workspace: Option<String>, pub limit: Option<i64> }

#[tauri::command]
pub async fn mission_timeline(state: State<'_, DbState>, query: Option<MissionQuery>) -> Result<Value, String> {
    let q = query.unwrap_or(MissionQuery { workspace: None, limit: None });
    let limit = q.limit.unwrap_or(120).clamp(10, 500);
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut receipts_sql = "SELECT id,ts,category,action,summary,detail,status,workspace,duration_ms FROM receipts WHERE 1=1".to_string();
    let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(w) = q.workspace.clone().filter(|s| !s.is_empty()) { receipts_sql.push_str(" AND workspace=?"); vals.push(Box::new(w)); }
    receipts_sql.push_str(" ORDER BY ts DESC, id DESC LIMIT ?");
    vals.push(Box::new(limit));
    let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
    let mut stmt = conn.prepare(&receipts_sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| {
        let detail_s: Option<String> = row.get(5)?;
        Ok(json!({
            "source":"receipt","id":row.get::<_,i64>(0)?,"ts":row.get::<_,i64>(1)?,"category":row.get::<_,String>(2)?,
            "action":row.get::<_,String>(3)?,"summary":row.get::<_,String>(4)?,
            "detail":detail_s.and_then(|s| serde_json::from_str::<Value>(&s).ok()),"status":row.get::<_,String>(6)?,
            "workspace":row.get::<_,Option<String>>(7)?,"duration_ms":row.get::<_,Option<i64>>(8)?
        }))
    }).map_err(|e| e.to_string())?;
    let mut timeline: Vec<Value> = rows.flatten().collect();

    // include recent snapshots
    let mut snap_sql = "SELECT id,ts,path,workspace,kind,bytes FROM snapshots WHERE 1=1".to_string();
    let mut svals: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(w) = q.workspace.filter(|s| !s.is_empty()) { snap_sql.push_str(" AND workspace=?"); svals.push(Box::new(w)); }
    snap_sql.push_str(" ORDER BY ts DESC, id DESC LIMIT ?");
    svals.push(Box::new((limit/2).max(20)));
    let sparams: Vec<&dyn rusqlite::types::ToSql> = svals.iter().map(|v| v.as_ref()).collect();
    if let Ok(mut stmt) = conn.prepare(&snap_sql) {
        if let Ok(rows) = stmt.query_map(sparams.as_slice(), |row| {
            Ok(json!({"source":"snapshot","id":row.get::<_,i64>(0)?,"ts":row.get::<_,i64>(1)?,"category":"timemachine","action":row.get::<_,String>(4)?,"summary":format!("Snapshot {}", row.get::<_,String>(2)?.split('/').last().unwrap_or("file")),"status":"ok","path":row.get::<_,String>(2)?,"workspace":row.get::<_,Option<String>>(3)?,"bytes":row.get::<_,i64>(5)?}))
        }) { timeline.extend(rows.flatten()); }
    }
    timeline.sort_by(|a,b| b.get("ts").and_then(|v| v.as_i64()).cmp(&a.get("ts").and_then(|v| v.as_i64())));
    timeline.truncate(limit as usize);

    let incidents = detect_incidents(&timeline);
    Ok(json!({"generated_at": now_ms(), "events": timeline, "incidents": incidents}))
}

fn detect_incidents(events: &[Value]) -> Vec<Incident> {
    let mut out = Vec::new();
    let errors: Vec<&Value> = events.iter().filter(|e| e.get("status").and_then(|s| s.as_str()) == Some("error")).collect();
    for e in errors.iter().take(8) {
        let cat = e.get("category").and_then(|v| v.as_str()).unwrap_or("system");
        let ts = e.get("ts").and_then(|v| v.as_i64()).unwrap_or(0);
        let summary = e.get("summary").and_then(|v| v.as_str()).unwrap_or("error");
        let related: Vec<Value> = events.iter().filter(|x| {
            let t = x.get("ts").and_then(|v| v.as_i64()).unwrap_or(0);
            (ts - t).abs() <= 120_000 && x.get("category").and_then(|v| v.as_str()) != Some("timemachine")
        }).take(8).cloned().collect();
        let mut actions = vec!["Inspect receipt details and related timeline events.".into()];
        if cat == "git" { actions.push("Open Git panel and verify repo state/credentials/branch.".into()); }
        if cat == "ai" { actions.push("Run AI runtime check and verify local endpoint/model.".into()); }
        if cat == "file" { actions.push("Use Time Machine to inspect or restore previous save.".into()); }
        if cat == "terminal" { actions.push("Check shell path/cwd and terminal output; restart terminal if needed.".into()); }
        out.push(Incident {
            id: format!("inc-{}-{}", ts, cat), ts, kind: format!("{}_error", cat), severity: "medium".into(),
            title: format!("{} incident", cat.to_uppercase()), summary: summary.to_string(),
            workspace: e.get("workspace").and_then(|v| v.as_str()).map(|s| s.to_string()),
            evidence: related, suggested_actions: actions,
        });
    }
    out
}
