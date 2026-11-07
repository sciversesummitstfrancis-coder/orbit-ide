use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use std::sync::Mutex;

pub struct StartupState(pub Mutex<StartupInner>);
pub struct StartupInner {
    #[allow(dead_code)]
    pub started_at: Instant,
    pub splash_ready: bool,
    pub frontend_ready: bool,
    pub main_shown: bool,
}
impl Default for StartupState {
    fn default() -> Self {
        Self(Mutex::new(StartupInner { started_at: Instant::now(), splash_ready: false, frontend_ready: false, main_shown: false }))
    }
}

#[derive(Serialize, Clone)]
pub struct InitEvent<'a> {
    pub step: &'a str,
    pub message: &'a str,
    pub progress: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub fn emit_init(app: &AppHandle, step: &'static str, message: &'static str, progress: u8) {
    let _ = app.emit("app://init-progress", InitEvent { step, message, progress, error: None });
}
pub fn emit_complete(app: &AppHandle, message: &'static str) {
    let _ = app.emit("app://init-complete", InitEvent { step: "complete", message, progress: 100, error: None });
}
pub fn emit_error(app: &AppHandle, message: &str) {
    let _ = app.emit("app://init-error", InitEvent { step: "error", message: "Startup issue detected", progress: 100, error: Some(message.to_string()) });
}

fn hide_splash(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("splash") { let _ = w.hide(); let _ = w.close(); }
}

pub fn reveal_main(app: &AppHandle) -> Result<(), String> {
    hide_splash(app);
    let main = app.get_webview_window("main").ok_or_else(|| "main window not found".to_string())?;
    main.show().map_err(|e| e.to_string())?;
    main.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn splash_ready(app: AppHandle, state: State<'_, StartupState>) -> Result<(), String> {
    {
        let mut s = state.0.lock().map_err(|_| "startup state lock")?;
        if s.splash_ready { return Ok(()); }
        s.splash_ready = true;
    }
    // Real milestones (DB/services/plugins already registered in setup; frontend signaled separately).
    // Messages map to the cinematic stages; frontend controls pacing/skip so app readiness is never delayed.
    emit_init(&app, "awakening", "SYSTEM AWAKENING", 6);
    std::thread::sleep(Duration::from_millis(120));
    emit_init(&app, "core", "CORE INITIALIZATION", 18);
    std::thread::sleep(Duration::from_millis(120));
    emit_init(&app, "sync", "MODULE SYNCHRONIZATION", 42);
    let app2 = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
        let (frontend_ready, main_shown) = app2.state::<StartupState>().0.lock().map(|s| (s.frontend_ready, s.main_shown)).unwrap_or((false, false));
        if main_shown { return; }
        if frontend_ready {
            emit_init(&app2, "env", "ENVIRONMENT PREPARATION", 78);
            std::thread::sleep(Duration::from_millis(160));
            emit_init(&app2, "final", "FINAL ACTIVATION", 94);
            std::thread::sleep(Duration::from_millis(120));
            emit_complete(&app2, "SYSTEM ONLINE");
        } else {
            emit_init(&app2, "env", "ENVIRONMENT PREPARATION", 66);
            for _ in 0..18 {
                std::thread::sleep(Duration::from_millis(350));
                let (frontend_ready, main_shown) = app2.state::<StartupState>().0.lock().map(|s| (s.frontend_ready, s.main_shown)).unwrap_or((false, false));
                if main_shown { return; }
                if frontend_ready {
                    emit_init(&app2, "final", "FINAL ACTIVATION", 94);
                    std::thread::sleep(Duration::from_millis(120));
                    emit_complete(&app2, "SYSTEM ONLINE");
                    return;
                }
            }
            emit_init(&app2, "final", "FINAL ACTIVATION", 92);
            emit_complete(&app2, "SYSTEM ONLINE");
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn frontend_ready(app: AppHandle, state: State<'_, StartupState>) -> Result<(), String> {
    let should_emit = {
        let mut s = state.0.lock().map_err(|_| "startup state lock")?;
        if s.frontend_ready { false } else { s.frontend_ready = true; !s.main_shown }
    };
    if should_emit {
        emit_init(&app, "env", "ENVIRONMENT PREPARATION", 82);
        std::thread::sleep(Duration::from_millis(80));
        emit_init(&app, "final", "FINAL ACTIVATION", 95);
        emit_complete(&app, "SYSTEM ONLINE");
    }
    Ok(())
}

#[tauri::command]
pub async fn show_main_window(app: AppHandle, state: State<'_, StartupState>) -> Result<(), String> {
    {
        let mut s = state.0.lock().map_err(|_| "startup state lock")?;
        if s.main_shown { hide_splash(&app); return Ok(()); }
        s.main_shown = true;
    }
    reveal_main(&app)
}
