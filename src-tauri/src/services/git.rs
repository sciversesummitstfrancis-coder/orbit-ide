use serde::Serialize;
use serde_json::json;
use std::path::Path;
use std::process::Command;
use std::time::Instant;
use tauri::State;
use crate::services::db::DbState;

fn git(dir: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git").arg("-C").arg(dir).args(args).output().map_err(|e| format!("git: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim_end().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim_end().to_string();
    if out.status.success() { Ok(stdout) } else { Err(if stderr.is_empty() { stdout } else { stderr }) }
}

#[derive(Serialize)]
pub struct GitStatus { pub is_repo: bool, pub branch: Option<String>, pub upstream: Option<String>, pub ahead: i64, pub behind: i64, pub changed: Vec<GitChange>, pub branches: Vec<String>, pub stashes: Vec<String> }
#[derive(Serialize)]
pub struct GitChange { pub path: String, pub status: String, pub staged: bool }

#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    if !Path::new(&path).exists() { return Ok(GitStatus { is_repo:false, branch:None, upstream:None, ahead:0, behind:0, changed:vec![], branches:vec![], stashes:vec![] }); }
    if git(&path, &["rev-parse", "--is-inside-work-tree"]).is_err() {
        return Ok(GitStatus { is_repo: false, branch: None, upstream: None, ahead: 0, behind: 0, changed: vec![], branches: vec![], stashes: vec![] });
    }
    let branch = git(&path, &["branch", "--show-current"]).ok().filter(|s| !s.is_empty());
    let upstream = git(&path, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).ok().filter(|s| !s.is_empty());
    let (ahead, behind) = git(&path, &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]).ok().and_then(|s| {
        let mut p = s.split_whitespace(); Some((p.next()?.parse().ok()?, p.next()?.parse().ok()?))
    }).map(|(b,a)|(a,b)).unwrap_or((0,0));
    let raw = git(&path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let changed = raw.lines().filter_map(|line| {
        if line.len() < 4 { return None; }
        let mut chars = line.chars();
        let x = chars.next().unwrap_or(' '); let y = chars.next().unwrap_or(' ');
        let staged = x != ' ' && x != '?';
        let status = if x != ' ' && x != '?' { x } else { y };
        let path = line[3..].trim().to_string();
        let path = path.split(" -> ").last().unwrap_or(&path).to_string();
        Some(GitChange { status: status.to_string(), staged, path })
    }).collect();
    let branches = git(&path, &["branch", "--format=%(refname:short)"]).unwrap_or_default().lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let stashes = git(&path, &["stash", "list", "-n", "10"]).unwrap_or_default().lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    Ok(GitStatus { is_repo: true, branch, upstream, ahead, behind, changed, branches, stashes })
}

#[tauri::command]
pub async fn git_run(state: State<'_, DbState>, path: String, args: Vec<String>) -> Result<String, String> {
    let start = Instant::now();
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let result = git(&path, &refs);
    let ms = start.elapsed().as_millis() as i64;
    let (status, summary, detail) = match &result {
        Ok(out) => ("ok", format!("git {}", args.first().map(|s| s.as_str()).unwrap_or("")), json!({"args": args, "output_preview": out.chars().take(500).collect::<String>()})),
        Err(e) => ("error", format!("git {} failed", args.first().map(|s| s.as_str()).unwrap_or("")), json!({"args": args, "error": e.chars().take(800).collect::<String>()})),
    };
    crate::services::receipts::try_record(&state, "git", "run", &summary, Some(&detail), status, Some(&path), Some(ms));
    result
}
