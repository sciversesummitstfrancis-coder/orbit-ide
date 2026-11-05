//! Integrated terminal using portable_pty for cross-platform PTY support.
//!
//! Supports Bash, Zsh, Fish and PowerShell where available on the host.

use portable_pty::{Command, PtyMaster, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use tauri::{Manager, State};
use uuid::Uuid;

use crate::state::{OrbitState, TerminalSession};

#[derive(Deserialize)]
pub struct CreateTerminalReq {
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub rows: Option<u16>,
    pub cols: Option<u16>,
}

#[derive(Serialize)]
pub struct TerminalInfo {
    pub id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub shell: String,
}

/// Detect the default system shell.
pub fn detect_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
    }
}

/// Create a new terminal session with a PTY.
#[tauri::command]
pub async fn terminal_create(
    state: State<'_, OrbitState>,
    app: tauri::AppHandle,
    req: CreateTerminalReq,
) -> Result<TerminalInfo, String> {
    let pty_system = PortablePtySystem::new().map_err(|e| format!("pty: {}", e))?;
    let shell = req.shell.unwrap_or_else(detect_shell);
    let cwd = req.cwd.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let size = PtySize {
        rows: req.rows.unwrap_or(24),
        cols: req.cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    };

    let mut pair = pty_system.openpty(size).map_err(|e| format!("openpty: {}", e))?;

    let mut cmd = Command::new(&shell);
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("PS1", "$ ");

    let child = pair.master.spawn_child(cmd).map_err(|e| format!("spawn: {}", e))?;
    let pid = child.process_id();

    let id = Uuid::new_v4().to_string();
    let master = Arc::new(pair.master);
    let reader = Arc::clone(&master);

    // Spawn a reader task that emits terminal output events.
    let app_clone = app.clone();
    let id_clone = id.clone();
    let cwd_clone = cwd.clone();
    let shell_clone = shell.clone();

    std::thread::spawn(move || {
        use std::io::Read;
        let mut reader = reader;
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(&format!("terminal://output:{}", id_clone), text);
                }
                Err(_) => break,
            }
        }
        let _ = app_clone.emit(&format!("terminal://exit:{}", id_clone), ());
    });

    let session = TerminalSession {
        id: id.clone(),
        pid,
        cwd: cwd_clone,
        shell: shell_clone,
    };

    state.terminal_sessions.lock().unwrap().insert(id.clone(), session);
    state.terminal_masters.lock().unwrap().insert(id.clone(), Arc::clone(&master));
    // Wrap the master for writing via a shared writer handle.
    let writer: Arc<StdMutex<dyn std::io::Write + Send>> =
        Arc::new(StdMutex::new(PtyWriteAdapter { master: Arc::clone(&master) }));
    state.terminal_writers.lock().unwrap().insert(id.clone(), writer);

    Ok(TerminalInfo {
        id,
        pid,
        cwd,
        shell,
    })
}

/// Adapter so we can store a Write handle alongside the Read thread.
struct PtyWriteAdapter {
    master: Arc<PtyMaster>,
}

impl std::io::Write for PtyWriteAdapter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.master.write(buf)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.master.flush()
    }
}

/// Write input to a terminal session.
#[tauri::command]
pub async fn terminal_write(
    state: State<'_, OrbitState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state.terminal_sessions.lock().unwrap();
    if !sessions.contains_key(&id) {
        return Err("session not found".to_string());
    }
    drop(sessions);

    if let Some(writer) = state.terminal_writers.lock().unwrap().get(&id) {
        use std::io::Write;
        let mut w = writer.lock().unwrap();
        w.write_all(data.as_bytes()).map_err(|e| format!("write: {}", e))?;
        w.flush().map_err(|e| format!("flush: {}", e))?;
    }
    Ok(())
}

/// Resize a terminal session.
#[tauri::command]
pub async fn terminal_resize(
    state: State<'_, OrbitState>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    if let Some(master) = state.terminal_masters.lock().unwrap().get(&id) {
        master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| format!("resize: {}", e))?;
    }
    Ok(())
}

/// Kill a terminal session.
#[tauri::command]
pub async fn terminal_kill(state: State<'_, OrbitState>, id: String) -> Result<(), String> {
    state.terminal_sessions.lock().unwrap().remove(&id);
    state.terminal_masters.lock().unwrap().remove(&id);
    state.terminal_writers.lock().unwrap().remove(&id);
    Ok(())
}

/// List all active terminal sessions.
#[tauri::command]
pub async fn terminal_list(state: State<'_, OrbitState>) -> Result<Vec<TerminalInfo>, String> {
    let sessions = state.terminal_sessions.lock().unwrap();
    Ok(sessions.values().map(|s| TerminalInfo {
        id: s.id.clone(),
        pid: s.pid,
        cwd: s.cwd.clone(),
        shell: s.shell.clone(),
    }).collect())
}