use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Default)]
pub struct TerminalState(pub Mutex<HashMap<String, TerminalSession>>);

pub struct TerminalSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Deserialize)]
pub struct CreateReq { pub cwd: Option<String>, pub cols: Option<u16>, pub rows: Option<u16> }
#[derive(Deserialize)]
pub struct WriteReq { pub id: String, pub data: String }
#[derive(Deserialize)]
pub struct ResizeReq { pub id: String, pub cols: u16, pub rows: u16 }
#[derive(Serialize, Clone)]
struct TermData { id: String, data: String }
#[derive(Serialize, Clone)]
struct TermExit { id: String, code: Option<i32> }
#[derive(Serialize)]
pub struct TermInfo { pub id: String }

fn default_shell() -> String {
    #[cfg(windows)]
    { return std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string()); }
    #[cfg(not(windows))]
    {
        if let Ok(shell) = std::env::var("SHELL") { if !shell.trim().is_empty() { return shell; } }
        for c in ["/bin/bash", "/usr/bin/bash", "/bin/zsh", "/usr/bin/zsh", "/bin/sh"] {
            if std::path::Path::new(c).exists() { return c.to_string(); }
        }
        "/bin/sh".to_string()
    }
}

#[tauri::command]
pub async fn terminal_create(app: AppHandle, state: State<'_, TerminalState>, req: CreateReq) -> Result<TermInfo, String> {
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
        rows: req.rows.unwrap_or(24).max(2), cols: req.cols.unwrap_or(80).max(2),
        pixel_width: 0, pixel_height: 0,
    }).map_err(|e| format!("pty open failed: {e}"))?;
    let mut cmd = CommandBuilder::new(default_shell());
    if let Some(cwd) = req.cwd.filter(|s| !s.trim().is_empty()) { cmd.cwd(cwd); }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    #[cfg(not(windows))]
    {
        if std::env::var_os("HOME").is_none() {
            if let Some(home) = dirs_next() { cmd.env("HOME", home); }
        }
    }
    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn shell failed: {e}"))?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| format!("pty reader failed: {e}"))?;
    let writer = pair.master.take_writer().map_err(|e| format!("pty writer failed: {e}"))?;
    let id = Uuid::new_v4().to_string();
    let id_emit = id.clone();
    let app_emit = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => { let _ = app_emit.emit("terminal://data", TermData { id: id_emit.clone(), data: String::from_utf8_lossy(&buf[..n]).to_string() }); }
                Err(_) => break,
            }
        }
        let _ = app_emit.emit("terminal://exit", TermExit { id: id_emit, code: None });
    });
    state.0.lock().map_err(|_| "terminal state lock")?.insert(id.clone(), TerminalSession { writer, master: pair.master, child });
    Ok(TermInfo { id })
}

#[cfg(not(windows))]
fn dirs_next() -> Option<String> { std::env::var("HOME").ok() }

#[tauri::command]
pub async fn terminal_write(state: State<'_, TerminalState>, req: WriteReq) -> Result<(), String> {
    let mut lock = state.0.lock().map_err(|_| "lock")?;
    let s = lock.get_mut(&req.id).ok_or("terminal not found")?;
    s.writer.write_all(req.data.as_bytes()).map_err(|e| e.to_string())?;
    s.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_resize(state: State<'_, TerminalState>, req: ResizeReq) -> Result<(), String> {
    let lock = state.0.lock().map_err(|_| "lock")?;
    let s = lock.get(&req.id).ok_or("terminal not found")?;
    s.master.resize(PtySize { rows: req.rows.max(2), cols: req.cols.max(2), pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_kill(state: State<'_, TerminalState>, id: String) -> Result<(), String> {
    let mut lock = state.0.lock().map_err(|_| "lock")?;
    if let Some(mut s) = lock.remove(&id) { let _ = s.child.kill(); }
    Ok(())
}

#[tauri::command]
pub async fn terminal_list(state: State<'_, TerminalState>) -> Result<Vec<String>, String> {
    Ok(state.0.lock().map_err(|_| "lock")?.keys().cloned().collect())
}
