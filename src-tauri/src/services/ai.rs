use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
use crate::services::db::DbState;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AiConfig {
    pub enabled: bool,
    pub provider: String,
    pub endpoint: String,
    pub model: String,
}

fn is_local_endpoint(url: &str) -> bool {
    let u = url.trim().to_lowercase();
    u.starts_with("http://127.0.0.1") || u.starts_with("http://localhost") || u.starts_with("http://[::1]")
}

fn read_config(conn: &rusqlite::Connection) -> AiConfig {
    crate::services::db::get_setting(conn, "ai.config").ok().flatten()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(AiConfig { enabled: false, provider: "ollama".into(), endpoint: "http://127.0.0.1:11434".into(), model: "".into() })
}

#[tauri::command]
pub async fn ai_get_config(db: State<'_, DbState>) -> Result<AiConfig, String> {
    let conn = db.0.lock().map_err(|_| "db lock")?;
    Ok(read_config(&conn))
}

#[tauri::command]
pub async fn ai_set_config(db: State<'_, DbState>, config: AiConfig) -> Result<(), String> {
    if config.enabled && !is_local_endpoint(&config.endpoint) {
        return Err("Only local AI endpoints are allowed (127.0.0.1/localhost/[::1]). No paid/cloud APIs are required or auto-configured.".into());
    }
    let conn = db.0.lock().map_err(|_| "db lock")?;
    crate::services::db::set_setting(&conn, "ai.config", &serde_json::to_string(&config).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn ai_complete(db: State<'_, DbState>, prompt: String) -> Result<Value, String> {
    let cfg = { let conn = db.0.lock().map_err(|_| "db lock")?; read_config(&conn) };
    if !cfg.enabled { return Err("Local AI is disabled. Enable it in Settings and configure a local model endpoint (e.g. Ollama).".into()); }
    if cfg.model.trim().is_empty() { return Err("No local AI model configured.".into()); }
    if !is_local_endpoint(&cfg.endpoint) { return Err("Only local endpoints are allowed.".into()); }
    let endpoint = format!("{}/api/generate", cfg.endpoint.trim_end_matches('/'));
    let model = cfg.model.clone();
    let resp = tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let r = ureq::post(&endpoint)
            .set("Content-Type", "application/json")
            .send_json(json!({"model": model, "prompt": prompt, "stream": false}))
            .map_err(|e| format!("local AI request failed: {e}. Ensure the local provider is running."))?;
        r.into_json::<Value>().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())??;
    Ok(resp)
}
