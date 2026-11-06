use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerConfig {
    pub id: String,
    pub language: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Default)]
pub struct LspState(pub Mutex<HashMap<String, LspSession>>);

pub struct LspSession {
    pub config: LspServerConfig,
    pub child: Child,
    pub stdin: Arc<Mutex<ChildStdin>>,
}

#[derive(Serialize, Clone)]
struct LspEvent { pub server_id: String, pub message: Value }

fn read_headers(reader: &mut BufReader<impl Read>) -> Option<usize> {
    let mut content_length = None;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).ok()? == 0 { return None; }
        let line = line.trim_end_matches(['\r', '\n']);
        if line.is_empty() { break; }
        if let Some(v) = line.strip_prefix("Content-Length:").or_else(|| line.strip_prefix("content-length:")) {
            content_length = v.trim().parse::<usize>().ok();
        }
    }
    content_length
}

#[tauri::command]
pub async fn lsp_list(state: State<'_, LspState>) -> Result<Vec<LspServerConfig>, String> {
    let lock = state.0.lock().map_err(|_| "lsp lock")?;
    Ok(lock.values().map(|s| s.config.clone()).collect())
}

#[tauri::command]
pub async fn lsp_start(app: AppHandle, state: State<'_, LspState>, config: LspServerConfig) -> Result<String, String> {
    if !config.enabled { return Err("server config is disabled; enable it explicitly (no silent downloads/starts)".into()); }
    if config.command.trim().is_empty() { return Err("missing command".into()); }
    let mut child = Command::new(&config.command)
        .args(&config.args)
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start '{}': {e}. Install/configure the language server manually.", config.command))?;
    let stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take();
    let id = config.id.clone();
    let stdin = Arc::new(Mutex::new(stdin));

    let app_out = app.clone();
    let id_out = id.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        while let Some(len) = read_headers(&mut reader) {
            let mut buf = vec![0u8; len];
            if reader.read_exact(&mut buf).is_err() { break; }
            if let Ok(message) = serde_json::from_slice::<Value>(&buf) {
                let _ = app_out.emit("lsp://message", LspEvent { server_id: id_out.clone(), message });
            }
        }
        let _ = app_out.emit("lsp://exit", serde_json::json!({"server_id": id_out}));
    });
    if let Some(stderr) = stderr {
        let app_err = app.clone();
        let id_err = id.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = app_err.emit("lsp://stderr", serde_json::json!({"server_id": id_err, "line": line}));
            }
        });
    }

    let mut lock = state.0.lock().map_err(|_| "lsp lock")?;
    lock.insert(id.clone(), LspSession { config, child, stdin });
    Ok(id)
}

#[tauri::command]
pub async fn lsp_send(state: State<'_, LspState>, server_id: String, message: Value) -> Result<(), String> {
    let lock = state.0.lock().map_err(|_| "lsp lock")?;
    let session = lock.get(&server_id).ok_or("lsp server not running")?;
    let body = serde_json::to_vec(&message).map_err(|e| e.to_string())?;
    let mut stdin = session.stdin.lock().map_err(|_| "stdin lock")?;
    write!(stdin, "Content-Length: {}\r\n\r\n", body.len()).map_err(|e| e.to_string())?;
    stdin.write_all(&body).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn lsp_stop(state: State<'_, LspState>, server_id: String) -> Result<(), String> {
    let mut lock = state.0.lock().map_err(|_| "lsp lock")?;
    if let Some(mut s) = lock.remove(&server_id) { let _ = s.child.kill(); }
    Ok(())
}
