# ORBIT IDE Progress

## Milestone 1–4 (complete)
- Host: Fedora 44 x86_64 (GNOME/Wayland); Rust 1.99.1; Node 22.14.0; Git 2.56.0.
- Project: `/home/shonshyjo/orbit-ide`, Tauri 2 + React + TypeScript + Vite. Identity `ORBIT IDE` (`dev.orbit.ide`).
- Orbit shell/design system, explorer (Open Folder + lazy tree + file open), Monaco editor with Orbit theme, dirty tabs, `Ctrl/Cmd+S` save via Rust `fs_write_file`.

## Milestone 5 — Integrated PTY terminal (baseline complete)
- Rust: `portable-pty` PTY sessions, default shell, workspace cwd, `terminal_create/write/resize/kill/list`, `terminal://data`/`terminal://exit`.
- Frontend: xterm.js + fit addon, multi-session tabs, create/kill, resize, Orbit theme.

## Milestone 6 — Git integration UI (baseline implemented)
- Rust: `git_status` (branch + staged/unstaged changes) and generic `git_run` over installed Git CLI.
- Frontend: `GitPanel` in bottom panel (`Git History` tab) — status/refresh, fetch, pull (`--ff-only`), push, stage/unstage selected files, stage all, diff per file, commit (requires staged files + message), history (`git log --oneline -n 20 --decorate`), output console. Source Control sidebar shows branch/changes summary.
- Uses installed Git executable/credentials; push/pull behavior depends on remote/auth configuration.
- **Not yet:** visual diff viewer/editor gutter, branch create/switch UI, merge/conflict UI, commit amend/stash, credential helper UX.

## Verification (latest)
- `cargo check`: pass.
- `npm run typecheck` + `npm run build`: pass (bundle-size warning only).
- `npx tauri build --debug --no-bundle`: pass → `src-tauri/target/debug/orbit-ide`.

## Next
- M7: optional configurable LSP (no silent downloads) — server registry/config, stdio JSON-RPC bridge, diagnostics/hover/definition plumbing.
- M8: SQLite workspace/settings persistence, recents, session restore/recovery.
- M9/M10: permissioned extensions + optional local AI; CI packaging/checksums; cross-platform test artifacts.
