//! Global application state managed by Tauri.

use parking_lot::Mutex;
use portable_pty::PtyMaster;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Clone, Debug, Default)]
pub struct LspServerInfo {
    pub language: String,
    pub command: String,
    pub args: Vec<String>,
    pub enabled: bool,
}

#[derive(Clone, Debug, Default)]
pub struct OrbitState {
    pub open_workspaces: Mutex<Vec<String>>,
    pub terminal_sessions: Mutex<HashMap<String, TerminalSession>>,
    pub terminal_masters: Mutex<HashMap<String, Arc<PtyMaster>>>,
    pub terminal_writers: Mutex<HashMap<String, Arc<Mutex<dyn std::io::Write + Send>>>>,
    pub lsp_sessions: Mutex<HashMap<String, LspSession>>,
    pub lsp_servers: Mutex<Vec<LspServerInfo>>,
    pub settings: Mutex<crate::settings::AppSettings>,
}

#[derive(Clone, Debug)]
pub struct TerminalSession {
    pub id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub shell: String,
}

#[derive(Clone, Debug)]
pub struct LspSession {
    pub id: String,
    pub language: String,
    pub workspace: String,
    pub child: Option<std::process::Child>,
}