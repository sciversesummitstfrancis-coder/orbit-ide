# ORBIT IDE Progress

## Milestone 1 — Environment + architecture (complete)
- Host: Fedora 44 x86_64 (GNOME/Wayland); Rust 1.99.1/Cargo 1.99.1; Node 22.14.0/npm 10.9.2; Git 2.56.0.
- Project: `/home/shonshyjo/orbit-ide`, Tauri 2 + React + TypeScript + Vite.
- Identity: `ORBIT IDE` (`dev.orbit.ide`), “Your code. Your environment. Your orbit.”
- Docs: `README.md`, `docs/architecture.md`, `docs/progress.md`.
- Rust service modules: `filesystem`, `git`, `settings`, `terminal`, `workspace` (partial/scaffold where noted).

## Milestone 2 — Shell + design system (complete)
- Orbit tokens/shell: deep charcoal + electric cyan/teal, restrained transitions.
- UI: header, activity bar, sidebar, editor area, bottom panel (Terminal/Problems/Output/Debug Console/Git History), status bar.

## Milestone 3 — Filesystem + explorer (baseline complete)
- Tauri dialog plugin/capability for folder open.
- Rust commands: `fs_read_file/write/list_dir/create/rename/delete`, `git_status`, `git_run`, settings stubs.
- Frontend: `src/services/orbit.ts`, Zustand workspace store, lazy `Explorer` tree, Open Folder flow, file-open tabs, Git branch/status indicators.

## Milestone 4 — Monaco editor + save workflow (baseline complete)
- `@monaco-editor/react` with Orbit dark theme, syntax mapping by extension, dirty tab marker, `Ctrl/Cmd+S` and Save to Rust `fs_write_file`.
- **Not yet:** split groups, full recovery/crash restore, advanced find/replace polish, full encoding/indent controls, LSP-connected Monaco services.

## Milestone 5 — Integrated terminal (baseline implemented)
- Rust PTY backend: `portable-pty` + `uuid`, `TerminalState`, commands `terminal_create/write/resize/kill/list`, `terminal://data` and `terminal://exit` events, default shell via `$SHELL`/`COMSPEC`, `TERM=xterm-256color`, workspace cwd passed on create.
- Frontend: `@xterm/xterm` + `@xterm/addon-fit` in `src/components/TerminalPanel.tsx`, multi-session tabs, create/kill, resize observer, input/output over Tauri invoke/events, Orbit terminal theme.
- **Not yet fully verified interactively:** PTY input/output in a live `tauri dev` GUI session (I verified compile/build; run app and confirm shell prompt/commands).
- **Not yet:** shell profile picker (Bash/Zsh/Fish/PowerShell), process metadata in status UI, robust session persistence, Windows/macOS runtime validation.

## Verification (latest)
- `cargo check` (`src-tauri`): pass.
- `npm run typecheck`: pass.
- `npm run build`: pass (bundle-size warning from Monaco/xterm; optimization pending).
- `npx tauri build --debug --no-bundle`: pass; binary `src-tauri/target/debug/orbit-ide`.

## Next
- M6: Git stage/unstage/commit/diff/history/branch/pull/push UI over CLI.
- M7: optional configurable LSP (no silent downloads).
- M8: SQLite workspace/settings persistence, recents, session restore/recovery.
- M9/M10: permissioned extensions + optional local AI; CI packaging/checksums; cross-platform test artifacts.
