use serde::Serialize;
use std::path::Path;
use std::process::Command;

fn git(dir: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git").arg("-C").arg(dir).args(args).output().map_err(|e| format!("git: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if out.status.success() { Ok(stdout) } else { Err(if stderr.is_empty() { stdout } else { stderr }) }
}

#[derive(Serialize)]
pub struct GitStatus { pub is_repo: bool, pub branch: Option<String>, pub changed: Vec<GitChange> }
#[derive(Serialize)]
pub struct GitChange { pub path: String, pub status: String, pub staged: bool }

#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    if !Path::new(&path).exists() { return Ok(GitStatus { is_repo:false, branch:None, changed:vec![] }); }
    if git(&path, &["rev-parse", "--is-inside-work-tree"]).is_err() {
        return Ok(GitStatus { is_repo: false, branch: None, changed: vec![] });
    }
    let branch = git(&path, &["branch", "--show-current"]).ok().filter(|s| !s.is_empty());
    let raw = git(&path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let changed = raw.lines().filter_map(|line| {
        if line.len() < 4 { return None; }
        let x = line.chars().next().unwrap_or(' '); let y = line.chars().nth(1).unwrap_or(' ');
        let staged = x != ' ' && x != '?';
        let status = if x != ' ' && x != '?' { x } else { y };
        Some(GitChange { status: status.to_string(), staged, path: line[3..].to_string() })
    }).collect();
    Ok(GitStatus { is_repo: true, branch, changed })
}

#[tauri::command]
pub async fn git_run(path: String, args: Vec<String>) -> Result<String, String> {
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    git(&path, &refs)
}
