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

## Milestone 7 — Optional configurable LSP framework (baseline implemented)
- Rust: `services/lsp.rs` with `LspState`, `lsp_list/start/send/stop`, stdio JSON-RPC framing (`Content-Length`), stdout → `lsp://message`, stderr → `lsp://stderr`, exit → `lsp://exit`. **No silent downloads**; start fails with a manual-install/configure message when command is unavailable/disabled.
- Frontend: `LspPanel` (Problems panel) exposes manual server config templates (TypeScript, Rust, Python, JSON), command/args editing, explicit Start/Stop, and live event log.
- Monaco is not yet fully wired to LSP protocol features (diagnostics/hover/definition/symbols) — this milestone provides the safe, configurable transport/control foundation.

## Next
- M8: SQLite workspace/settings persistence (rusqlite bundled), recent projects, session restore/recovery, settings integration including LSP configs.
- M9: permissioned extension architecture + optional local AI (Ollama/local endpoint) — never mandatory.
- M10: CI (GitHub Actions native runners), cross-platform packaging, checksums/docs, automated tests and artifact verification.

## Milestone 8 — SQLite persistence (baseline implemented)
- Rust: `rusqlite` (bundled) DB in Tauri app data dir (`orbit.db`, WAL). Tables: `settings`, `recent_workspaces`, `session_state`.
- Commands: `settings_get/set` (persisted JSON values), `workspace_add_recent/list_recent`, `session_save/restore`.
- Frontend: recent workspaces on welcome screen, "Open Recent", session restore on startup (desktop/Tauri only), debounced session persistence for root/active/open files, recent list updated on open.
- **Not yet:** robust dirty-file content recovery across crashes, settings UI editor, recents removal/pinning, full multi-root workspace metadata.

## Verification (latest)
- `cargo check`: pass.
- `npm run typecheck` + `npm run build`: pass (bundle-size warning only).
- `npx tauri build --debug --no-bundle`: pass → `src-tauri/target/debug/orbit-ide`.

## Milestone 9 — Extensions + optional local AI (baseline scaffolds)
- **Extensions (permissioned scaffold):** Rust reads manifests from app-data `extensions/*/orbit-extension.json` (`id`, `name`, `version`, `description`, `permissions`, `contributes`), lists/enable-disable state in SQLite. Untrusted extensions are not granted unrestricted filesystem/process access; runtime activation/sandbox execution is intentionally deferred.
- **Optional local AI:** local-endpoint-only config (`127.0.0.1`/`localhost`/`[::1]`), disabled by default, persisted in SQLite; `ai_complete` calls local provider `/api/generate` (Ollama-style) via `ureq` in blocking task. No paid/cloud APIs required or auto-configured.
- Frontend: Extensions activity shows manifests/status; Settings shows local AI config/test prompt + LSP entry point.

## Milestone 10 — Packaging/CI/testing (planned baseline next)
- Add GitHub Actions native-runner workflows for check/build/package, checksums, release artifacts, and install docs.
- Do not claim platform artifacts are functional without platform builds/tests.

## Milestone 10 — CI/packaging/tests/docs (baseline added)
- Added `.github/workflows/ci.yml` (frontend typecheck/build; Ubuntu Rust check + test with Tauri deps).
- Added `.github/workflows/release.yml` (native-runner matrix via `tauri-apps/tauri-action`, draft release; Windows x64, Ubuntu 24.04, macOS ARM64/Intel targets configured). Workflow requires GitHub Actions environment to run; **not executed/verified in this session**.
- Added `scripts/checksums.sh`, `docs/installation.md`, `docs/testing.md`; updated `README.md` and `package.json` scripts.
- `npm run check`: pass. `cargo test`: pass (0 tests currently — test coverage is still needed). Checksum script smoke-tested on `dist/`.
- **Honest status:** no platform installers/DMG/RPM/DEB/AppImage artifacts were produced and tested on all target OSes in this session. Do not claim release artifacts are functional until built and smoke-tested on each target platform/architecture.

## Local AI direction (practical, ORBIT-appropriate)
- **Not implemented:** training a foundation model from scratch (impractical/costly for this project) and no claim of being "better than online agents overall".
- **Implemented baseline:** optional, disabled-by-default, **local-endpoint-only** assistant (`127.0.0.1`/`localhost`/`[::1]`) with SQLite-persisted config, Ollama-compatible `/api/generate` + `/api/tags` model discovery, and grounded tasks (explain code/error, suggest refactor, draft commit, generate docs, custom) using user-chosen local context (active file excerpt, Git summary, pasted error text). Output is advisory; no cloud/paid API path is enabled by default.
- **Next valuable steps:** Monaco selection capture, diff/diagnostic context wiring, streaming responses, explicit "apply suggestion" review flow, benchmark/eval prompts for modest hardware, and optional local runtime detection (Ollama) without auto-download.
