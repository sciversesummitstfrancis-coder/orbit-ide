use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
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
    pub error_text: Option<String>,
}

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
async fn local_post(endpoint: String, body: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let r = ureq::post(&endpoint).set("Content-Type", "application/json").send_json(body)
            .map_err(|e| format!("local AI request failed: {e}. Ensure the local provider is running."))?;
        r.into_json::<Value>().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
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
pub async fn ai_list_models(db: State<'_, DbState>) -> Result<Vec<String>, String> {
    let cfg = read_config(&*db.0.lock().map_err(|_| "db lock")?);
    if !is_local_endpoint(&cfg.endpoint) { return Err("Only local endpoints are allowed.".into()); }
    let endpoint = format!("{}/api/tags", cfg.endpoint.trim_end_matches('/'));
    let v = local_post(endpoint, json!({})).await?;
    let models = v.get("models").and_then(|m| m.as_array()).map(|arr| arr.iter().filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())).collect()).unwrap_or_default();
    Ok(models)
}
#[tauri::command]
pub async fn ai_complete(db: State<'_, DbState>, prompt: String) -> Result<Value, String> {
    ai_run_task(db, AiContext { task: Some("custom".into()), prompt: Some(prompt), active_path: None, active_content: None, selection: None, git_summary: None, error_text: None }).await
}
#[tauri::command]
pub async fn ai_run_task(db: State<'_, DbState>, ctx: AiContext) -> Result<Value, String> {
    let cfg = read_config(&*db.0.lock().map_err(|_| "db lock")?);
    if !cfg.enabled { return Err("Local AI is disabled. Enable it in Settings and configure a local model endpoint (e.g. Ollama).".into()); }
    if cfg.model.trim().is_empty() { return Err("No local AI model configured.".into()); }
    if !is_local_endpoint(&cfg.endpoint) { return Err("Only local endpoints are allowed.".into()); }
    let task = ctx.task.as_deref().unwrap_or("custom");
    let user = ctx.prompt.as_deref().unwrap_or("").trim();
    let file = ctx.active_path.as_deref().unwrap_or("(no active file)");
    let code = ctx.selection.as_deref().filter(|s| !s.trim().is_empty()).or(ctx.active_content.as_deref()).unwrap_or("");
    let instruction = match task {
        "explain_code" => "Explain the selected code or active file excerpt clearly and concisely. Mention behavior, important edge cases, and likely risks.",
        "explain_error" => "Explain the error/diagnostic and likely causes using the provided context. Suggest concrete next checks or fixes. Do not invent unseen files or output.",
        "suggest_refactor" => "Suggest a safe, minimal refactor for the provided code. Keep behavior unchanged unless stated. Show focused code snippets when useful.",
        "draft_commit" => "Draft a concise Git commit message from the provided git summary/changes. Use imperative mood. Return subject and optional short body.",
        "generate_docs" => "Generate concise documentation/comments for the provided code. Be accurate and avoid unsupported claims.",
        _ => "Help with the user's request using only the provided local context.",
    };
    let prompt = format!(
        "You are ORBIT Local Assistant, an optional local coding helper inside a desktop IDE. You run on-device via a local model endpoint. \nBe accurate, concise, and practical. Never claim to have run commands, read files, or seen output unless included below. \nIf context is missing, say what is missing. Prefer safe, minimal changes.\n\nTask: {task}\nInstruction: {instruction}\n\nUser request:\n{}\n\nWorkspace context:\nActive file: {file}\nGit summary:\n{}\nError/diagnostics:\n{}\nCode/selection (truncated):\n```text\n{}\n```",
        if user.is_empty() { "(none)" } else { user },
        truncate(ctx.git_summary.as_deref().unwrap_or("(none)"), 4000),
        truncate(ctx.error_text.as_deref().unwrap_or("(none)"), 2500),
        truncate(code, 12000),
    );
    let endpoint = format!("{}/api/generate", cfg.endpoint.trim_end_matches('/'));
    let model = cfg.model.clone();
    local_post(endpoint, json!({"model": model, "prompt": prompt, "stream": false})).await
}
