//! Application settings persistence backed by SQLite.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EditorSettings {
    pub font_family: String,
    pub font_size: u32,
    pub tab_size: u32,
    pub insert_spaces: bool,
    pub word_wrap: bool,
    pub show_minimap: bool,
    pub show_line_numbers: bool,
    pub theme: String,
    pub accent_color: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub editor: EditorSettings,
    pub terminal: TerminalSettings,
    pub git: GitSettings,
    pub lsp: LspSettings,
    pub general: GeneralSettings,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TerminalSettings {
    pub font_family: String,
    pub font_size: u32,
    pub shell: Option<String>,
    pub cursor_blink: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitSettings {
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub auto_fetch: bool,
    pub confirm_before_push: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LspSettings {
    pub enabled: bool,
    pub auto_start: bool,
    pub servers: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneralSettings {
    pub recent_workspaces: Vec<String>,
    pub max_recent: usize,
    pub restore_session: bool,
    pub telemetry: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            editor: EditorSettings {
                font_family: "JetBrains Mono".into(),
                font_size: 14,
                tab_size: 2,
                insert_spaces: true,
                word_wrap: "off".into(),
                show_minimap: true,
                show_line_numbers: true,
                theme: "orbit-dark".into(),
                accent_color: "#00e5ff".into(),
            },
            terminal: TerminalSettings {
                font_family: "JetBrains Mono".into(),
                font_size: 14,
                shell: None,
                cursor_blink: true,
            },
            git: GitSettings {
                user_name: None,
                user_email: None,
                auto_fetch: false,
                confirm_before_push: true,
            },
            lsp: LspSettings {
                enabled: true,
                auto_start: true,
                servers: vec![],
            },
            general: GeneralSettings {
                recent_workspaces: vec![],
                max_recent: 10,
                restore_session: true,
                telemetry: false,
            },
        }
    }
}

/// Resolve the settings file path.
pub fn settings_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from(".orbit"));
    let _ = std::fs::create_dir_all(&dir);
    dir.join("settings.json")
}

/// Load settings from disk, falling back to defaults.
pub fn load_settings(app: &tauri::AppHandle) -> AppSettings {
    let path = settings_dir(app);
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(s) = serde_json::from_str::<AppSettings>(&data) {
                return s;
            }
        }
    }
    AppSettings::default()
}

/// Persist settings to disk.
pub fn save_settings(app: &tauri::AppHandle, settings: &AppSettings) -> anyhow::Result<()> {
    let path = settings_dir(app);
    let data = serde_json::to_string_pretty(settings)?;
    std::fs::write(path, data)?;
    Ok(())
}

#[tauri::command]
pub async fn settings_get(app: tauri::AppHandle) -> Result<AppSettings, String> {
    Ok(load_settings(&app))
}

#[tauri::command]
pub async fn settings_set(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    save_settings(&app, &settings).map_err(|e| format!("save: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn settings_reset(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let s = AppSettings::default();
    save_settings(&app, &s).map_err(|e| format!("save: {}", e))?;
    Ok(s)
}