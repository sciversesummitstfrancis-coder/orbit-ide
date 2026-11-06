use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use tauri::State;
use crate::services::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Finding {
    pub severity: String,
    pub category: String,
    pub title: String,
    pub evidence: String,
    pub path: Option<String>,
    pub recommendation: String,
}

fn push(findings: &mut Vec<Finding>, sev: &str, cat: &str, title: &str, evidence: impl Into<String>, path: Option<String>, rec: &str) {
    findings.push(Finding { severity: sev.into(), category: cat.into(), title: title.into(), evidence: evidence.into(), path, recommendation: rec.into() });
}

fn scan_text(path: &Path, text: &str, findings: &mut Vec<Finding>) {
    let p = path.to_string_lossy().to_string();
    let lower = text.to_lowercase();
    if text.contains("-----BEGIN ") && lower.contains("private key") || text.contains("-----BEGIN OPENSSH PRIVATE KEY") || text.contains("-----BEGIN RSA PRIVATE KEY") {
        push(findings, "high", "secret", "Possible private key material", "matched private key marker", Some(p.clone()), "Remove key material from workspace; rotate if exposed.");
    }
    if text.contains("AKIA") { push(findings, "high", "secret", "Possible AWS access key", "matched AKIA", Some(p.clone()), "Remove credential and rotate immediately."); }
    if text.contains("ghp_") { push(findings, "high", "secret", "Possible GitHub token", "matched ghp_", Some(p.clone()), "Revoke token and remove from files/history."); }
    if lower.contains("password =") || lower.contains("password:") || lower.contains("api_key") || lower.contains("apikey") {
        push(findings, "medium", "secret", "Possible credential assignment", "matched password/api key assignment pattern", Some(p.clone()), "Verify this is not a real secret; move secrets to env/secret manager.");
    }
}

#[derive(Deserialize)]
pub struct TrustScanReq { pub workspace: Option<String>, pub active_path: Option<String>, pub active_content: Option<String> }

#[tauri::command]
pub async fn trust_scan(state: State<'_, DbState>, req: Option<TrustScanReq>) -> Result<Value, String> {
    let req = req.unwrap_or(TrustScanReq { workspace: None, active_path: None, active_content: None });
    let mut findings: Vec<Finding> = Vec::new();
    if let (Some(path), Some(content)) = (req.active_path.as_ref(), req.active_content.as_ref()) {
        scan_text(Path::new(path), content, &mut findings);
    }
    if let Some(ws) = req.workspace.as_ref() {
        // scan small set of common config files only (local, bounded)
        for name in [".env", ".env.local", "config.json", "settings.json", ".npmrc", ".git/config"] {
            let p = Path::new(ws).join(name);
            if let Ok(meta) = fs::metadata(&p) {
                if meta.is_file() && meta.len() <= 512_000 {
                    if let Ok(text) = fs::read_to_string(&p) { scan_text(&p, &text, &mut findings); }
                }
            }
        }
    }
    // inspect recent receipts for destructive patterns
    if let Ok(conn) = state.0.lock() {
        if let Ok(mut stmt) = conn.prepare("SELECT category, action, summary, detail, status FROM receipts ORDER BY ts DESC LIMIT 80") {
            if let Ok(rows) = stmt.query_map([], |row| Ok((row.get::<_,String>(0)?, row.get::<_,String>(1)?, row.get::<_,String>(2)?, row.get::<_,Option<String>>(3)?, row.get::<_,String>(4)?))) {
                for r in rows.flatten() {
                    let detail = r.3.unwrap_or_default().to_lowercase();
                    let sum = r.2.to_lowercase();
                    if r.0 == "git" && (detail.contains("reset --hard") || detail.contains("push --force") || detail.contains("clean -fd")) {
                        push(&mut findings, "high", "destructive", "Potentially destructive git command in receipts", r.2.clone(), None, "Review intent before re-running destructive git operations.");
                    }
                    if r.4 == "error" && (sum.contains("token") || detail.contains("credential")) {
                        push(&mut findings, "medium", "auth", "Auth/credential-related failure observed", r.2.clone(), None, "Verify credentials locally; never paste secrets into files or chat.");
                    }
                }
            }
        }
    }
    let high = findings.iter().filter(|f| f.severity=="high").count();
    let medium = findings.iter().filter(|f| f.severity=="medium").count();
    Ok(json!({"summary":{"high":high,"medium":medium,"total":findings.len()},"findings":findings,"scope":"Bounded local scan (active file, common config files, recent receipts). No cloud scanning."}))
}
