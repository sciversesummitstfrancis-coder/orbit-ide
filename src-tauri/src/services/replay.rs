use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
use crate::services::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReplayPlanStep {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub safe: bool,
    pub requires_confirm: bool,
    pub command: Option<Vec<String>>,
    pub path: Option<String>,
    pub note: String,
}

#[derive(Deserialize)]
pub struct ReplayReq { pub capsule_id: Option<String>, pub workspace: Option<String> }

#[tauri::command]
pub async fn replay_plan(state: State<'_, DbState>, req: ReplayReq) -> Result<Value, String> {
    let conn = state.0.lock().map_err(|_| "db lock")?;
    let mut steps: Vec<ReplayPlanStep> = Vec::new();
    let mut capsule: Option<Value> = None;
    if let Some(id) = req.capsule_id {
        if let Ok(data_s) = conn.query_row("SELECT data FROM capsules WHERE id=?1", rusqlite::params![id], |r| r.get::<_,String>(0)) {
            capsule = serde_json::from_str(&data_s).ok();
            steps.push(ReplayPlanStep { id:"capsule".into(), kind:"context".into(), title:"Load capsule context".into(), safe:true, requires_confirm:false, command:None, path:capsule.as_ref().and_then(|c| c.get("root")).and_then(|v| v.as_str()).map(|s| s.to_string()), note:"Restore open files/active file context in editor (read-only to disk until user saves).".into() });
        }
    }
    if let Some(c) = &capsule {
        if let Some(files) = c.get("openFiles").and_then(|v| v.as_array()) {
            for (i,f) in files.iter().take(12).enumerate() {
                if let Some(p) = f.get("path").and_then(|v| v.as_str()) {
                    steps.push(ReplayPlanStep { id:format!("open-{i}"), kind:"file".into(), title:format!("Open {}", p.split('/').last().unwrap_or(p)), safe:true, requires_confirm:false, command:None, path:Some(p.to_string()), note:"Read file from disk and open in editor buffer.".into() });
                }
            }
        }
        steps.push(ReplayPlanStep { id:"git-status".into(), kind:"git".into(), title:"Check git status".into(), safe:true, requires_confirm:true, command:Some(vec!["status".into(),"--short".into(),"--branch".into()]), path:c.get("root").and_then(|v| v.as_str()).map(|s| s.to_string()), note:"Explicitly user-approved read-only git check.".into() });
    } else {
        steps.push(ReplayPlanStep { id:"noop".into(), kind:"context".into(), title:"No capsule selected".into(), safe:true, requires_confirm:false, command:None, path:req.workspace, note:"Choose a Task Capsule to generate a deterministic replay checklist. ORBIT never runs commands without explicit approval.".into() });
    }
    Ok(json!({"plan": steps, "policy":"Deterministic replay is a checklist/plan. File opens read from disk; git/terminal commands run only after explicit confirmation and are recorded as receipts.", "capsule": capsule}))
}
