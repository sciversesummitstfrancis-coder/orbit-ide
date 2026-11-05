//! ORBIT IDE — Rust backend.
//!
//! Tauri 2 application backend providing filesystem, terminal, git, LSP,
//! workspace and settings services exposed to the React frontend as commands.

use tauri::{Manager, WindowEvent};

mod filesystem;
mod git;
mod lsp;
mod settings;
mod state;
mod terminal;
mod workspace;
mod extensions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new()
            .level(log::LevelFilter::Info)
            .build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let handle = app.handle();
            let state = state::OrbitState::new()?;
            app.manage(state);

            // Configure window close behavior to hide instead of quit (like VS Code).
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.on_window_event(|event| {
                    if let WindowEvent::CloseRequested { .. } = event {
                        // Keep the app running in the tray / background.
                    }
                });
            }

            // Register LSP servers discovered on PATH.
            if let Ok(servers) = lsp::discover_language_servers(&handle) {
                if let Some(s) = handle.try_state::<state::OrbitState>() {
                    *s.lsp_servers.lock().unwrap() = servers;
                }
            }

            let _ = handle;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // filesystem
            filesystem::read_file,
            filesystem::write_file,
            filesystem::list_dir,
            filesystem::stat_path,
            filesystem::create_file,
            filesystem::create_dir,
            filesystem::rename_path,
            filesystem::delete_path,
            filesystem::watch_directory,
            // workspace
            workspace::open_workspace,
            workspace::list_recent_workspaces,
            workspace::save_workspace_session,
            workspace::close_workspace,
            // terminal
            terminal::terminal_create,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            terminal::terminal_list,
            // git
            git::git_status,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_diff,
            git::git_branch_list,
            git::git_branch_switch,
            git::git_pull,
            git::git_push,
            // lsp
            lsp::lsp_start,
            lsp::lsp_request,
            lsp::lsp_stop,
            lsp::lsp_list_servers,
            // settings
            settings::settings_get,
            settings::settings_set,
            settings::settings_reset,
            // extensions
            extensions::extension_list,
            extensions::extension_enable,
            extensions::extension_disable,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}