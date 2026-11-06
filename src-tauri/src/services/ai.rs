use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use crate::services::db::DbState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub enabled: bool,
    pub provider: String,
    pub endpoint: String,
    pub model: String,
}
impl Default for AiConfig {
    fn default() -> Self {
        Self { enabled: false, provider: "ollama".into(), endpoint: "http://127.0.0.1:11434".into(), model: "".into() }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiContext {
    pub task: Option<String>,
    pub prompt: Option<String>,
    pub active_path: Option<String>,
    pub active_content: Option<String>,
    pub selection: Option<String>,
    pub git_summary: Option<String>,
    pub git_diff: Option<String>,
    pub diagnostics: Option<String>,
    pub error_text: Option<String>,
}

#[derive(Default)]
pub struct AiStreamState(pub Mutex<HashMap<String, Arc<AtomicBool>>>);

#[derive(Serialize, Clone)]
struct AiChunk { id: String, chunk: String, done: bool, error: Option<String> }

fn is_local_endpoint(url: &str) -> bool {
    let u = url.trim().to_lowercase();
    u.starts_with("http://127.0.0.1") || u.starts_with("http://localhost") || u.starts_with("http://[::1]")
}
fn read_config(conn: &rusqlite::Connection) -> AiConfig {
    crate::services::db::get_setting(conn, "ai.config").ok().flatten()
        .and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}
fn truncate(s: &str, max: usize) -> String {
    let t = s.trim();
    if t.chars().count() <= max { t.to_string() } else { format!("{}… [truncated]", t.chars().take(max).collect::<String>()) }
}
fn build_prompt(ctx: &AiContext) -> String {
    let task = ctx.task.as_deref().unwrap_or("custom");
    let user = ctx.prompt.as_deref().unwrap_or("").trim();
    let file = ctx.active_path.as_deref().unwrap_or("(no active file)");
    let code = ctx.selection.as_deref().filter(|s| !s.trim().is_empty()).or(ctx.active_content.as_deref()).unwrap_or("");
    let instruction = match task {
        "explain_code" => "Explain the selected code or active file excerpt clearly and concisely. Mention behavior, important edge cases, and likely risks.",
        "explain_error" => "Explain the error/diagnostic and likely causes using the provided context. Suggest concrete next checks or fixes. Do not invent unseen files or output.",
        "suggest_refactor" => "Suggest a safe, minimal refactor for the provided code. Prefer returning a single fenced code block with the full replacement for the selected scope/file excerpt when practical. Keep behavior unchanged unless stated.",
        "draft_commit" => "Draft a concise Git commit message from the provided git summary/diff. Use imperative mood. Return subject and optional short body.",
        "generate_docs" => "Generate concise documentation/comments for the provided code. Be accurate and avoid unsupported claims.",
        _ => "Help with the user's request using only the provided local context.",
    };
    format!(
        "You are ORBIT AI, an optional local coding assistant inside ORBIT IDE. You run on-device via a local model endpoint.\n\
Be accurate, concise, and practical. Never claim to have run commands, read files, or seen output unless included below.\n\
If context is missing, say what is missing. Prefer safe, minimal changes. Suggestions are advisory and must be reviewed before applying.\n\n\
Task: {task}\nInstruction: {instruction}\n\nUser request:\n{}\n\nWorkspace context:\nActive file: {file}\nGit summary:\n{}\nGit diff (truncated):\n{}\nDiagnostics/LSP info:\n{}\nError/diagnostics text:\n{}\nCode/selection (truncated):\n```text\n{}\n```",
        if user.is_empty() { "(none)" } else { user },
        truncate(ctx.git_summary.as_deref().unwrap_or("(none)"), 3500),
        truncate(ctx.git_diff.as_deref().unwrap_or("(none)"), 7000),
        truncate(ctx.diagnostics.as_deref().unwrap_or("(none)"), 2500),
        truncate(ctx.error_text.as_deref().unwrap_or("(none)"), 2500),
        truncate(code, 12000),
    )
}

#[tauri::command]
pub async fn ai_get_config(db: State<'_, DbState>) -> Result<AiConfig, String> {
    Ok(read_config(&*db.0.lock().map_err(|_| "db lock")?))
}
#[tauri::command]
pub async fn ai_set_config(db: State<'_, DbState>, config: AiConfig) -> Result<(), String> {
    if config.enabled && !is_local_endpoint(&config.endpoint) {
        return Err("Only local AI endpoints are allowed (127.0.0.1/localhost/[::1]). No paid/cloud APIs are required or auto-configured.".into());
    }
    crate::services::db::set_setting(&*db.0.lock().map_err(|_| "db lock")?, "ai.config", &serde_json::to_string(&config).map_err(|e| e.to_string())?)
}
#[tauri::command]
pub async fn ai_check_runtime(db: State<'_, DbState>) -> Result<Value, String> {
    let cfg = read_config(&*db.0.lock().map_err(|_| "db lock")?);
    if !is_local_endpoint(&cfg.endpoint) { return Err("Only local endpoints are allowed.".into()); }
    let endpoint = format!("{}/api/tags", cfg.endpoint.trim_end_matches('/'));
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let agent = ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(4)).build();
        let r = agent.get(&endpoint).call()
            .map_err(|e| format!("runtime unavailable: {e}. ORBIT does not auto-install or download models/providers."))?;
        r.into_json::<Value>().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?;
    match result {
        Ok(v) => {
            let models = v.get("models").and_then(|m| m.as_array()).map(|arr| arr.iter().filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())).collect::<Vec<_>>()).unwrap_or_default();
            Ok(json!({"ok": true, "endpoint": cfg.endpoint, "model_configured": cfg.model, "model_available": cfg.model.is_empty() || models.iter().any(|m| m == &cfg.model), "models": models, "note": "Local runtime reachable. ORBIT never auto-installs providers or downloads models."}))
        }
        Err(e) => Ok(json!({"ok": false, "endpoint": cfg.endpoint, "model_configured": cfg.model, "models": [], "error": e, "note": "Start your local provider (e.g. Ollama) and install/pull a model manually if needed."}))
    }
}
#[tauri::command]
pub async fn ai_list_models(db: State<'_, DbState>) -> Result<Vec<String>, String> {
    let v = ai_check_runtime(db).await?;
    Ok(v.get("models").and_then(|m| m.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default())
}
#[tauri::command]
pub async fn ai_cancel(streams: State<'_, AiStreamState>, id: String) -> Result<(), String> {
    if let Some(flag) = streams.0.lock().map_err(|_| "stream lock")?.get(&id) { flag.store(true, Ordering::SeqCst); }
    Ok(())
}

#[tauri::command]
pub async fn ai_run_task(db: State<'_, DbState>, ctx: AiContext) -> Result<Value, String> {
    let cfg = read_config(&*db.0.lock().map_err(|_| "db lock")?);
    if !cfg.enabled { return Err("Local AI is disabled. Enable it in Settings and configure a local model endpoint (e.g. Ollama).".into()); }
    if cfg.model.trim().is_empty() { return Err("No local AI model configured.".into()); }
    if !is_local_endpoint(&cfg.endpoint) { return Err("Only local endpoints are allowed.".into()); }
    let prompt = build_prompt(&ctx);
    let endpoint = format!("{}/api/generate", cfg.endpoint.trim_end_matches('/'));
    let model = cfg.model.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let r = ureq::post(&endpoint).set("Content-Type", "application/json")
            .send_json(json!({"model": model, "prompt": prompt, "stream": false}))
            .map_err(|e| format!("local AI request failed: {e}. Ensure the local provider is running."))?;
        r.into_json::<Value>().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn ai_complete(db: State<'_, DbState>, prompt: String) -> Result<Value, String> {
    ai_run_task(db, AiContext { task: Some("custom".into()), prompt: Some(prompt), active_path: None, active_content: None, selection: None, git_summary: None, git_diff: None, diagnostics: None, error_text: None }).await
}

#[tauri::command]
pub async fn ai_stream_task(app: AppHandle, streams: State<'_, AiStreamState>, db: State<'_, DbState>, ctx: AiContext) -> Result<String, String> {
    let cfg = read_config(&*db.0.lock().map_err(|_| "db lock")?);
    if !cfg.enabled { return Err("Local AI is disabled. Enable it in Settings and configure a local model endpoint (e.g. Ollama).".into()); }
    if cfg.model.trim().is_empty() { return Err("No local AI model configured.".into()); }
    if !is_local_endpoint(&cfg.endpoint) { return Err("Only local endpoints are allowed.".into()); }
    let id = uuid::Uuid::new_v4().to_string();
    let cancel = Arc::new(AtomicBool::new(false));
    streams.0.lock().map_err(|_| "stream lock")?.insert(id.clone(), cancel.clone());
    let prompt = build_prompt(&ctx);
    let endpoint = format!("{}/api/generate", cfg.endpoint.trim_end_matches('/'));
    let model = cfg.model.clone();
    let app2 = app.clone();
    let id2 = id.clone();
    let cancel2 = cancel.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let emit = |chunk: String, done: bool, error: Option<String>| {
            let _ = app2.emit("ai://chunk", AiChunk { id: id2.clone(), chunk, done, error });
        };
        if cancel2.load(Ordering::SeqCst) { emit(String::new(), true, Some("cancelled".into())); return; }
        let resp = match ureq::post(&endpoint).set("Content-Type", "application/json")
            .send_json(json!({"model": model, "prompt": prompt, "stream": true})) {
            Ok(r) => r,
            Err(e) => { emit(String::new(), true, Some(format!("local AI request failed: {e}. Ensure the local provider is running."))); return; }
        };
        let reader = BufReader::new(resp.into_reader());
        for line in reader.lines() {
            if cancel2.load(Ordering::SeqCst) { emit(String::new(), true, Some("cancelled".into())); return; }
            let Ok(line) = line else { break; };
            if line.trim().is_empty() { continue; }
            if let Ok(v) = serde_json::from_str::<Value>(&line) {
                let chunk = v.get("response").and_then(|r| r.as_str()).unwrap_or("").to_string();
                let done = v.get("done").and_then(|d| d.as_bool()).unwrap_or(false);
                let err = v.get("error").and_then(|e| e.as_str()).map(|s| s.to_string());
                emit(chunk, done, err.clone());
                if done || err.is_some() { return; }
            }
        }
        emit(String::new(), true, None);
    });
    Ok(id)
}
