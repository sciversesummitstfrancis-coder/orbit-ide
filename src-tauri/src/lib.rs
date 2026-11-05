mod services;
use services::{filesystem, git, settings};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running ORBIT IDE");
}
