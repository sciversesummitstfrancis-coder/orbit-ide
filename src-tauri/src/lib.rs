mod services;
use services::{ai, db, extensions, filesystem, git, lsp, receipts, settings, terminal, workspace};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = db::init(app.handle())?;
            app.manage(db);
            Ok(())
        })
        .manage(terminal::TerminalState::default())
        .manage(lsp::LspState::default())
        .manage(ai::AiStreamState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            filesystem::fs_read_file,
            filesystem::fs_write_file,
            filesystem::fs_list_dir,
            filesystem::fs_create,
            filesystem::fs_rename,
            filesystem::fs_delete,
            git::git_status,
            git::git_run,
            settings::settings_get,
            settings::settings_set,
            terminal::terminal_create,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            terminal::terminal_list,
            lsp::lsp_list,
            lsp::lsp_start,
            lsp::lsp_send,
            lsp::lsp_stop,
            workspace::workspace_add_recent,
            workspace::workspace_list_recent,
            workspace::workspace_remove_recent,
            workspace::session_save,
            workspace::session_restore,
            extensions::extensions_list,
            extensions::extensions_set_enabled,
            extensions::extensions_scaffold,
            ai::ai_get_config,
            ai::ai_set_config,
            ai::ai_list_models,
            ai::ai_check_runtime,
            ai::ai_cancel,
            ai::ai_complete,
            ai::ai_run_task,
            ai::ai_stream_task,
            receipts::receipts_list,
            receipts::receipts_clear,
            receipts::receipts_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ORBIT IDE");
}
