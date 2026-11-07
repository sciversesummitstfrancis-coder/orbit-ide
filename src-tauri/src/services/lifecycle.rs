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
    if let Some(w) = app.get_webview_window("splash") {
        let _ = w.hide();
        let _ = w.close();
    }
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
    // Milestones reflect real startup phases (DB/services/plugins registered in setup;
    // frontend mount signaled by frontend_ready) with timed pacing so the sequence is legible.
    emit_init(&app, "system", "INITIALIZING SYSTEM", 12);
    std::thread::sleep(Duration::from_millis(90));
    emit_init(&app, "environment", "ESTABLISHING ENVIRONMENT", 28);
    std::thread::sleep(Duration::from_millis(90));
    emit_init(&app, "modules", "LOADING CORE MODULES", 46);
    std::thread::sleep(Duration::from_millis(90));
    emit_init(&app, "sync", "SYNCHRONIZING COMPONENTS", 64);
    let app2 = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(420));
        let (frontend_ready, main_shown) = app2.state::<StartupState>().0.lock().map(|s| (s.frontend_ready, s.main_shown)).unwrap_or((false, false));
        if main_shown { return; }
        if frontend_ready {
            emit_init(&app2, "workspace", "PREPARING WORKSPACE", 88);
            std::thread::sleep(Duration::from_millis(120));
            emit_complete(&app2, "SYSTEM ONLINE");
        } else {
            emit_init(&app2, "workspace", "PREPARING WORKSPACE", 82);
            std::thread::sleep(Duration::from_millis(900));
            let main_shown = app2.state::<StartupState>().0.lock().map(|s| s.main_shown).unwrap_or(false);
            if !main_shown { emit_complete(&app2, "SYSTEM ONLINE"); }
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
        emit_init(&app, "workspace", "PREPARING WORKSPACE", 90);
        std::thread::sleep(Duration::from_millis(80));
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
