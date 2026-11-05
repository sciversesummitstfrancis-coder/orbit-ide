# ORBIT IDE Progress

## Milestone 1 — Environment + architecture (complete)
- Host: Fedora 44 x86_64 (GNOME/Wayland); Rust 1.99.1/Cargo 1.99.1; Node 22.14.0/npm 10.9.2; Git 2.56.0.
- Project: `/home/shonshyjo/orbit-ide`, Tauri 2 + React + TypeScript + Vite.
- Identity: `ORBIT IDE` (`dev.orbit.ide`), “Your code. Your environment. Your orbit.”
- Docs: `README.md`, `docs/architecture.md`, `docs/progress.md`.
- Rust service modules: `filesystem`, `git`, `settings` commands; `terminal`/`workspace` scaffolds.

## Milestone 2 — Shell + design system (complete)
- Orbit tokens/shell: deep charcoal + electric cyan/teal, restrained transitions.
- UI: header, activity bar, sidebar, editor area, bottom panel (Terminal/Problems/Output/Debug Console/Git History), status bar.

## Milestone 3 — Filesystem + explorer (baseline complete)
- Tauri dialog plugin/capability for folder open.
- Rust commands: `fs_read_file/write/list_dir/create/rename/delete`, `git_status`, `git_run`, settings stubs.
- Frontend: `src/services/orbit.ts`, Zustand workspace store, lazy `Explorer` tree, Open Folder flow, file-open tabs, Git branch/status indicators.

## Milestone 4 — Monaco editor + save workflow (baseline complete)
- Integrated `@monaco-editor/react` with Orbit dark theme (`src/components/Editor.tsx`), syntax by extension, minimap/folding/bracket matching basics.
- Active file edits tracked in store; dirty tab marker (`•`); `Ctrl/Cmd+S` and header Save write through Rust `fs_write_file`; Git status can be refreshed.
- **Not yet:** split editor groups, full file recovery/crash restore, find/replace UI polish, encoding/indent controls, advanced Monaco language workers/LSP wiring.

## Verification (latest)
- `cargo check` (`src-tauri`): pass.
- `npx tauri info`: Tauri 2.12.x, webkit2gtk 2.54.2/rsvg2 2.62.4 detected.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- `npx tauri build --debug --no-bundle`: pass; binary at `src-tauri/target/debug/orbit-ide` (ELF x86_64, rebuilt 2026-11-05 local time).
- Brief smoke launch under Wayland session timed out as a running GUI process (expected); no captured stderr in that run. Full interactive validation: `cd /home/shonshyjo/orbit-ide && npm run tauri dev`.

## Next
- M5: real PTY terminal (Rust `portable-pty`/equivalent, cross-platform shell detection) + xterm.js renderer, multi-session/resize/kill.
- M6: Git stage/unstage/commit/diff/history/branch/pull/push UI over CLI.
- M7: optional configurable LSP (no silent downloads).
- M8: SQLite workspace/settings persistence, recents, session restore/recovery.
- M9/M10: permissioned extensions + optional local AI; CI packaging/checksums; test artifacts per platform.
