use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use tauri::{AppHandle, Manager, State};
use crate::services::db::DbState;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    #[serde(default)] pub version: String,
    #[serde(default)] pub description: String,
    #[serde(default)] pub permissions: Vec<String>,
    #[serde(default)] pub contributes: Value,
}
#[derive(Debug, Clone, Serialize)]
pub struct ExtensionInfo { pub manifest: ExtensionManifest, pub path: String, pub enabled: bool, pub trusted: bool }

fn extensions_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("extensions");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
fn enabled_key(id: &str) -> String { format!("ext.enabled.{id}") }

#[tauri::command]
pub async fn extensions_list(app: AppHandle, db: State<'_, DbState>) -> Result<Vec<ExtensionInfo>, String> {
    let dir = extensions_dir(&app)?;
    let conn = db.0.lock().map_err(|_| "db lock")?;
    let mut out = vec![];
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() { continue; }
        let manifest_path = path.join("orbit-extension.json");
        if !manifest_path.exists() { continue; }
        let text = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
        let manifest: ExtensionManifest = serde_json::from_str(&text).map_err(|e| format!("manifest {}: {e}", manifest_path.display()))?;
        let enabled = crate::services::db::get_setting(&conn, &enabled_key(&manifest.id))?.map(|v| v == "true" || v == "\"true\"").unwrap_or(false);
        out.push(ExtensionInfo { manifest, path: path.to_string_lossy().to_string(), enabled, trusted: false });
    }
    out.sort_by(|a,b| a.manifest.name.to_lowercase().cmp(&b.manifest.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
pub async fn extensions_set_enabled(db: State<'_, DbState>, id: String, enabled: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "db lock")?;
    crate::services::db::set_setting(&conn, &enabled_key(&id), if enabled { "true" } else { "false" })
}

#[tauri::command]
pub async fn extensions_scaffold() -> Result<Value, String> {
    Ok(json!({
        "status": "scaffold",
        "note": "Permissioned extension runtime is not active. ORBIT reads manifests from app-data/extensions/*/orbit-extension.json. Untrusted extensions never receive unrestricted filesystem/process access. Activation/execution sandbox is planned.",
        "manifest_schema": {"id":"string","name":"string","version":"string","description":"string","permissions":["filesystem.read","terminal","git","lsp","ui"],"contributes":{}}
    }))
}
