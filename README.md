# ORBIT IDE

> Your code. Your environment. Your orbit.

ORBIT IDE is an open-source, cross-platform desktop code editor built with **Tauri 2 (Rust)**, **React + TypeScript**, **Monaco Editor**, **SQLite**, the **Git CLI**, and optional **Language Server Protocol** integrations.

## Goals
- Native desktop application (not a web app wrapper).
- One shared codebase for Windows, Linux, and macOS.
- Lightweight behavior for modest hardware (target: i5-6200U, 8 GB RAM).
- Works offline for ordinary editing; no paid APIs or mandatory cloud accounts.

## Stack
- **Backend:** Rust, Tauri 2
- **Frontend:** React, TypeScript, Vite
- **Editor:** Monaco Editor
- **Persistence:** SQLite (via Rust service)
- **Version control:** Git CLI
- **Language intelligence:** Configurable LSP (optional, no silent downloads)
- **Terminal:** PTY-backed integrated terminal via Rust process management

## Repository layout
```
orbit-ide/
  docs/                 Architecture, progress, environment notes
  src/                  React frontend
    components/         UI shell and feature components
    services/           Frontend IPC/service adapters
    store/              UI/workspace state
    styles/             Design system and global styles
  src-tauri/            Rust backend
    src/
      services/         Cross-platform filesystem/terminal/git/LSP/settings services
  .github/workflows/    CI/build automation (planned)
```

## Development
Prerequisites (platform-specific): Rust toolchain, Node.js/npm, Tauri system deps, Git.
Optional: language servers (user-configured), Ollama (local AI).

```bash
cd orbit-ide
npm install
npm run tauri dev
```

Build:
```bash
npm run tauri build
```

## Environment note (Milestone 1)
Host checked: Fedora Linux 44, x86_64, Rust 1.99.1, Cargo 1.99.1, Node 22.14.0, npm 10.9.2, Git 2.56.0.
Missing on this host: Tauri WebKit/GTK dev packages (`webkit2gtk4.1-devel`, `librsvg2-devel`, `libappindicator-gtk3-devel`) and `sqlite3` CLI (SQLite library integration will use Rust crate). GUI `tauri dev/build` requires installing OS prerequisites.

## Status
Implementation is incremental by milestone. See `docs/progress.md`.
