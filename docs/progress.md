# ORBIT IDE Progress

## Milestone 1 — Environment + architecture (baseline complete)
- Inspected host: Fedora Linux 44, x86_64; Rust 1.99.1/Cargo 1.99.1; Node 22.14.0/npm 10.9.2; Git 2.56.0.
- Created/normalized Tauri 2 + React + TypeScript project at `/home/shonshyjo/orbit-ide`.
- Product config: `ORBIT IDE` (`dev.orbit.ide`), tagline “Your code. Your environment. Your orbit.”
- Added architecture and baseline backend service modules (`filesystem`, `git`, `settings` scaffolds; `terminal`/`workspace` placeholders).
- **Host blocker (native):** `cargo check` in `src-tauri` fails because system deps for Tauri/WebKitGTK are missing (`libsoup-3.0`/`webkit2gtk4.1` dev packages, etc.). Frontend build/typecheck pass.

## Milestone 2 — Application shell + design system (frontend baseline complete)
- Implemented Orbit design tokens (deep charcoal, electric cyan/teal accents, restrained transitions).
- Built shell layout: header (brand/workspace/command/settings), activity bar, sidebar, editor tabs/area, bottom panel tabs (Terminal/Problems/Output/Debug/Git History), status bar.
- **Verified:** `npm run typecheck` passes; `npm run build` passes (`dist/` produced).

## Next (Milestone 3+)
- Install host Tauri prerequisites, then run `cargo check`/`npm run tauri dev`.
- Wire filesystem commands to explorer UI (open folder, tree, CRUD, context actions).
- Integrate Monaco (tabs, dirty state, save, recovery), real PTY terminal, Git CLI UI, optional/configurable LSP, SQLite workspace/settings persistence, extensions/local-AI scaffolds, CI packaging.
