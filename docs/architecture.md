# ORBIT IDE Architecture (Milestone 1 baseline)

## High-level
- **Desktop host:** Tauri 2 (Rust). Exposes cross-platform services as Tauri commands/events.
- **UI:** React + TypeScript + Vite.
- **Editor engine:** Monaco Editor (Milestone 4).
- **Persistence:** SQLite via Rust (`rusqlite`, bundled) for workspace/session/settings state.
- **VCS:** Git CLI integration (Milestone 6), invoked through Rust process abstraction.
- **LSP:** Optional, user-configured language servers over stdio/JSON-RPC (Milestone 7). No silent downloads.
- **Terminal:** PTY-backed sessions managed in Rust (Milestone 5), rendered with xterm.js in frontend.
- **Optional AI:** Local-provider abstraction (e.g. Ollama) disabled by default (Milestone 9).

## Frontend modules (`src/`)
- `components/` — app shell (header, activity bar, explorer, editor area, bottom panel, status bar), reusable UI.
- `services/` — typed Tauri `invoke` wrappers and event subscriptions.
- `store/` — workspace/editor/terminal state.
- `styles/` — design tokens (charcoal/cyan/teal), global layout, component styles.

## Backend modules (`src-tauri/src/`)
- `lib.rs` / `main.rs` — app bootstrap, plugin registration, command registration.
- `services/filesystem.rs` — safe path operations, directory tree, read/write, watch hooks.
- `services/terminal.rs` — PTY session lifecycle and IO.
- `services/git.rs` — Git CLI commands/parsing.
- `services/lsp.rs` — server registry, process/JSON-RPC bridge.
- `services/workspace.rs` — open folder, recents, session restore.
- `services/settings.rs` — defaults + persisted user settings.
- `services/extensions.rs` — manifest discovery/permissioned activation (scaffold first).

## Cross-platform rules
- No hardcoded Linux paths/shells. Resolve app data/config/temp via Tauri/path APIs.
- Terminal uses platform default shell with explicit support for Bash/Zsh/Fish/PowerShell when present.
- Packaging targets: Windows x64 (exe/portable), Linux RPM/DEB/AppImage/Flatpak (practical), macOS ARM64/Intel DMG.

## Security
- Tauri capability allowlist scoped to required commands/plugins.
- No secrets committed. Optional AI and LSP are local/user-configured.
- Extension system must be permissioned; untrusted code not granted unrestricted filesystem/process access by default.

## Performance targets
- Fast startup, lazy-load Monaco/workspace indexing, avoid background scans.
- Target baseline: i5-6200U, 8 GB RAM, Intel HD 520, Fedora Linux.
