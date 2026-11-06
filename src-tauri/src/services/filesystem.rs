use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tauri::State;
use crate::services::db::DbState;

#[derive(Deserialize)]
pub struct ListDirReq { pub path: String }
#[derive(Deserialize)]
pub struct WriteFileReq { pub path: String, pub content: String }
#[derive(Deserialize)]
pub struct CreateReq { pub path: String, pub is_dir: bool }
#[derive(Deserialize)]
pub struct RenameReq { pub from: String, pub to: String }

#[derive(Serialize, Clone)]
pub struct DirEntry {
    pub name: String, pub path: String, pub is_dir: bool, pub is_file: bool,
    pub is_hidden: bool, pub size: Option<u64>, pub ext: Option<String>,
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read_file {path}: {e}"))
}

#[tauri::command]
pub async fn fs_write_file(state: State<'_, DbState>, req: WriteFileReq) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&req.path).parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let bytes = req.content.len();
    let path = req.path.clone();
    let res = fs::write(&req.path, req.content).map_err(|e| format!("write_file {}: {e}", req.path));
    let (status, err) = match &res { Ok(_) => ("ok", None), Err(e) => ("error", Some(e.clone())) };
    let mut detail = json!({"path": path, "bytes": bytes});
    if let Some(e) = err { detail["error"] = json!(e); }
    crate::services::receipts::try_record(&state, "file", "save", &format!("Saved {}", PathBuf::from(&detail["path"].as_str().unwrap_or("")).file_name().and_then(|s| s.to_str()).unwrap_or("file")), Some(&detail), status, detail["path"].as_str(), None);
    res
}

#[tauri::command]
pub async fn fs_list_dir(req: ListDirReq) -> Result<Vec<DirEntry>, String> {
    let path = PathBuf::from(&req.path);
    if !path.is_dir() { return Err(format!("not a directory: {}", req.path)); }
    let mut entries = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().ok();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        entries.push(DirEntry {
            is_hidden: name.starts_with('.'),
            ext: entry.path().extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()),
            size: meta.as_ref().and_then(|m| if m.is_file() { Some(m.len()) } else { None }),
            name, path: entry.path().to_string_lossy().to_string(), is_dir,
            is_file: meta.as_ref().map(|m| m.is_file()).unwrap_or(false),
        });
    }
    entries.sort_by(|a,b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(entries)
}

#[tauri::command]
pub async fn fs_create(req: CreateReq) -> Result<(), String> {
    let p = PathBuf::from(&req.path);
    if req.is_dir { fs::create_dir_all(&p).map_err(|e| e.to_string()) }
    else {
        if let Some(parent) = p.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        fs::File::create(&p).map_err(|e| e.to_string()).map(|_| ())
    }
}

#[tauri::command]
pub async fn fs_rename(req: RenameReq) -> Result<(), String> { fs::rename(&req.from, &req.to).map_err(|e| e.to_string()) }

#[tauri::command]
pub async fn fs_delete(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() { fs::remove_dir_all(&p).map_err(|e| e.to_string()) } else { fs::remove_file(&p).map_err(|e| e.to_string()) }
}
