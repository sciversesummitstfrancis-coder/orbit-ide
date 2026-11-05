# ORBIT IDE Progress

## Milestone 1 — Environment + architecture (complete)
- Host: Fedora 44 x86_64; Rust 1.99.1/Cargo 1.99.1; Node 22.14.0/npm 10.9.2; Git 2.56.0.
- Project: `/home/shonshyjo/orbit-ide`, Tauri 2 + React + TypeScript + Vite.
- Identity: `ORBIT IDE` (`dev.orbit.ide`), “Your code. Your environment. Your orbit.”
- Docs: `README.md`, `docs/architecture.md`, `docs/progress.md`.
- Rust service modules: `filesystem`, `git`, `settings` commands; `terminal`/`workspace` scaffolds.

## Milestone 2 — Shell + design system (complete, frontend verified)
- Orbit tokens/shell: deep charcoal + electric cyan/teal, restrained transitions.
- UI: header, activity bar, sidebar, editor tabs/welcome, bottom panel tabs (Terminal/Problems/Output/Debug Console/Git History), status bar.

## Milestone 3 — Filesystem + explorer (baseline implemented, frontend verified)
- Tauri dialog plugin enabled; capabilities allow open dialog.
- Rust commands: `fs_read_file`, `fs_write_file`, `fs_list_dir`, `fs_create`, `fs_rename`, `fs_delete`, `git_status`, `git_run`, settings stubs.
- Frontend: `src/services/orbit.ts` invoke adapter, Zustand workspace store, `Explorer` tree (lazy directory load), open-folder flow, file-open tabs, read-only content surface (Monaco editing in M4), Git branch/status indicator in sidebar/status.
- **Verified:** `cargo check` passes in `src-tauri` (after host deps installed); `npm run typecheck` passes; `npm run build` passes.
- **Not yet claimed:** interactive GUI verification of `npm run tauri dev`/packaging in this session; full CRUD context menus/drag-drop/file watchers deferred.

## Next
- M4: Monaco editor, dirty tracking, save/Save As, multi-tab close behavior, recovery, split groups, shortcuts.
- M5: real PTY terminal (Rust) + xterm.js, multi-session, resize/kill, default shell detection.
- M6: Git stage/unstage/commit/diff/history/branch/pull/push UI using CLI service.
- M7: optional configurable LSP (no silent downloads).
- M8: SQLite workspace/settings persistence, recent projects, session restore.
- M9/M10: permissioned extensions + optional local AI; CI packaging/checksums.
