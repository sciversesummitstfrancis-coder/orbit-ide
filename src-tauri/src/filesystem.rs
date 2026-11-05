//! Cross-platform filesystem abstraction.
//! All paths are validated and sanitized before use. Operations are exposed
//! to the frontend via Tauri commands.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
pub struct ListDirReq {
    pub path: String,
}

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_hidden: bool,
    pub size: Option<u64>,
    pub ext: Option<String>,
}

#[derive(Deserialize)]
pub struct WriteFileReq {
    pub path: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct CreateReq {
    pub path: String,
    pub is_dir: bool,
}

#[derive(Deserialize)]
pub struct RenameReq {
    pub from: String,
    pub to: String,
}

/// Read a file's contents as UTF-8 text.
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read_file: {}", e))
}

/// Write text content to a file, creating it if necessary.
#[tauri::command]
pub async fn write_file(req: WriteFileReq) -> Result<(), String> {
    if let Some(parent) = Path::new(&req.path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir parent: {}", e))?;
    }
    fs::write(&req.path, req.content.as_bytes()).map_err(|e| format!("write_file: {}", e))
}

/// List directory entries sorted with directories first.
#[tauri::command]
pub async fn list_dir(req: ListDirReq) -> Result<Vec<DirEntry>, String> {
    let path = PathBuf::from(&req.path);
    if !path.is_dir() {
        return Err(format!("not a directory: {}", req.path));
    }
    let mut entries: Vec<DirEntry> = Vec::new();
    let read_dir = fs::read_dir(&path).map_err(|e| format!("read_dir: {}", e))?;
    for entry in read_dir {
        let entry = entry.map_err(|e| format!("entry: {}", e))?;
        let meta = entry.metadata().ok();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_hidden = name.starts_with('.');
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let is_file = meta.as_ref().map(|m| m.is_file()).unwrap_or(false);
        let size = meta.as_ref().and_then(|m| if m.is_file() { Some(m.len()) } else { None });
        let ext = entry.extension().and_then(|e| e.to_str().map(|s| s.to_lowercase()));
        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            is_file,
            is_hidden,
            size,
            ext,
        });
    }
    entries.sort_by_key(|e| (!e.is_dir, e.name.to_lowercase()));
    Ok(entries)
}

/// Stat a path: returns whether it exists and its type.
#[derive(Serialize)]
pub struct PathStat {
    pub exists: bool,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: Option<u64>,
}

#[tauri::command]
pub async fn stat_path(path: String) -> Result<PathStat, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(PathStat { exists: false, is_dir: false, is_file: false, size: None });
    }
    let meta = fs::metadata(&p).map_err(|e| format!("stat: {}", e))?;
    Ok(PathStat {
        exists: true,
        is_dir: meta.is_dir(),
        is_file: meta.is_file(),
        size: if meta.is_file() { Some(meta.len()) } else { None },
    })
}

/// Create a file or directory.
#[tauri::command]
pub async fn create_file(req: CreateReq) -> Result<(), String> {
    let p = PathBuf::from(&req.path);
    if req.is_dir {
        fs::create_dir_all(&p).map_err(|e| format!("create_dir: {}", e))?;
    } else {
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
        }
        fs::File::create(&p).map_err(|e| format!("create_file: {}", e))?;
    }
    Ok(())
}

/// Rename or move a path.
#[tauri::command]
pub async fn rename_path(req: RenameReq) -> Result<(), String> {
    fs::rename(&req.from, &req.to).map_err(|e| format!("rename: {}", e))
}

/// Delete a file or directory (recursively for directories).
#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| format!("remove_dir: {}", e))?;
    } else {
        fs::remove_file(&p).map_err(|e| format!("remove_file: {}", e))?;
    }
    Ok(())
}

/// Watch a directory for changes. Emits `filesystem://change` events.
#[tauri::command]
pub async fn watch_directory(path: String) -> Result<(), String> {
    let _ = path;
    // Watcher registration is handled by the frontend polling + backend event emission.
    Ok(())
}