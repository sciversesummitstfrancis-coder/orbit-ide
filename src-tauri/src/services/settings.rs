use serde_json::Value;
#[tauri::command]
pub async fn settings_get(_key: Option<String>) -> Result<Value, String> { Ok(serde_json::json!({})) }
#[tauri::command]
pub async fn settings_set(_key: String, _value: Value) -> Result<(), String> { Ok(()) }
