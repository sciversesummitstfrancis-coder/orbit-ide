# ORBIT IDE

> Your code. Your environment. Your orbit.

ORBIT IDE is an open-source, cross-platform desktop code editor built with **Tauri 2 (Rust)**, **React + TypeScript**, **Monaco Editor**, **SQLite**, the **Git CLI**, and optional user-configured **LSP** and **local AI** integrations.

## Principles
- Native desktop app (Tauri), not a web wrapper.
- Shared codebase for Windows, Linux, and macOS.
- Offline-capable for ordinary editing.
- No paid APIs, subscriptions, or mandatory cloud accounts.
- No silent downloads of language servers or AI models.

## Implemented baseline (milestones 1–10 scaffold)
- **Shell/UI:** Orbit design system, activity bar, sidebar, tabs, bottom panels, status bar.
- **Filesystem:** open folder dialog, lazy explorer tree, read/write/create/rename/delete commands (Rust).
- **Editor:** Monaco integration, dirty tracking, save (`Ctrl/Cmd+S`).
- **Terminal:** Rust PTY sessions (`portable-pty`) + xterm.js, multi-session, resize/kill, workspace cwd.
- **Git:** status + generic CLI runner; panel for status/fetch/pull/push/stage/unstage/diff/commit/history.
- **LSP:** optional manual config/start/stop and stdio JSON-RPC event bridge; no auto-install. Full Monaco protocol wiring pending.
- **Persistence:** SQLite (`rusqlite` bundled) for settings, recent workspaces, session restore.
- **Extensions/AI:** permissioned extension manifest scaffold (no unrestricted untrusted execution); optional local-only AI adapter (localhost), disabled by default.
- **CI/Release:** GitHub Actions workflows (checks + Tauri draft release matrix), checksum/install/testing docs. **Artifacts must be built and tested per target platform before claiming support.**

## Development
Prerequisites: Rust toolchain, Node.js/npm, Git, and [Tauri v2 system dependencies](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run check            # typecheck + frontend build
cd src-tauri && cargo check
npm run tauri dev
```

Useful scripts: `npm run typecheck`, `npm run build`, `npm run test:rust`, `npm run checksums`.

## Docs
- `docs/architecture.md` — architecture and module boundaries.
- `docs/progress.md` — milestone status and verification.
- `docs/installation.md` — install/checksum guidance.
- `docs/testing.md` — smoke tests and release verification policy.
