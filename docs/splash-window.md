# Native Splash Window

ORBIT uses a **dedicated frameless Tauri splash window** (not an in-app React route/modal) before the main IDE window is shown.

## Lifecycle
1. `tauri.conf.json` defines two windows:
   - `splash` (`splash.html`, 520×320, frameless, transparent, always-on-top, centered, visible)
   - `main` (`index.html`, normal IDE window, initially hidden)
2. Rust setup hides `main`, shows/focuses `splash`, initializes SQLite/services, and emits progress events.
3. Splash frontend (`src/splash-main.tsx`, `src/splash.css`) listens for `app://init-progress` / `app://init-complete` / `app://init-error`, then calls `splash_ready`.
4. Main frontend (`src/App.tsx`) calls `frontend_ready` after mount; Rust emits completion when ready.
5. Splash requests `show_main_window` only after real readiness + minimum visible time + short READY hold; Rust shows/focuses `main` and hides/closes `splash`.

## Fallbacks & safety
- Progress reflects real initialization milestones where available; a max-wait fallback prevents a stuck splash.
- Startup errors are shown in the splash with a “Continue” option.
- Startup state prevents duplicate reveals/splash windows.
- `prefers-reduced-motion` reduces animations/transitions.
- If transparency is unsupported, the splash still renders with an opaque card background fallback.

## Files
- `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- `src-tauri/src/lib.rs`, `src-tauri/src/services/lifecycle.rs`, `src-tauri/src/services/mod.rs`
- `splash.html`, `src/splash-main.tsx`, `src/splash.css`, `vite.config.ts`
