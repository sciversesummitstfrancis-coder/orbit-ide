# ORBIT IDE Progress

## Summary
ORBIT IDE has functional local baselines for Milestones 1–10 on Fedora/Linux (current dev host). Remaining items that require native platform runners, signed release infrastructure, or deep protocol/UI work are tracked as **deferred/honest gaps** below — they are not falsely marked complete.

## Milestone 1–4 — Core shell/editor (baseline complete)
- Tauri 2 + React + TypeScript + Vite, identity `ORBIT IDE` (`dev.orbit.ide`).
- Orbit shell/design system, explorer (open folder, lazy tree, file open), Monaco editor with Orbit theme, dirty tabs, `Ctrl/Cmd+S` save via Rust `fs_write_file`.

## Milestone 5 — Integrated PTY terminal (baseline complete)
- Rust `portable-pty` sessions, default shell, workspace cwd, create/write/resize/kill/list, `terminal://data`/`terminal://exit`.
- xterm.js multi-session tabs, fit addon, create/kill/clear, resize on panel expand/drag. Desktop-only (Tauri) by design.

## Milestone 6 — Git integration UI (improved baseline)
- Rust `git_status` exposes repo state, branch, upstream, ahead/behind, changed files, local branches, stash list; `git_run` executes local git CLI args in workspace.
- Git panel: status/refresh/fetch/pull `--ff-only`/push, stage/unstage/stage-all, staged+unstaged diff, commit (staged + message), stash push/pop, history graph, branch switch/create, discard tracked changes (confirm). Uses installed Git/credentials.
- **Deferred:** Monaco gutter/visual diff, merge/conflict UI, amend/interactive rebase, remote/credential helper UX.

## Milestone 7 — Optional configurable LSP framework (baseline)
- Rust stdio JSON-RPC bridge (`Content-Length`), `lsp_list/start/send/stop`, `lsp://message`/`stderr`/`exit`. No silent downloads/starts; manual command/config required.
- LSP panel has templates (TS/Rust/Python/JSON), explicit Start/Stop, event log.
- **Deferred:** full Monaco language-client wiring (diagnostics markers, hover, definition, completion, symbols, rename), per-workspace persisted server configs UI.

## Milestone 8 — SQLite persistence (improved baseline)
- `rusqlite` bundled DB in app data (`orbit.db`, WAL): `settings`, `recent_workspaces`, `session_state`.
- Recent workspaces (add/list/remove, limit 30), welcome-screen Open/Remove Recent, startup session restore (desktop), debounced session save of root/active/open file paths.
- **Deferred:** dirty/unsaved content crash-recovery snapshots, settings editor UI, recents pinning, multi-root workspace metadata.

## Milestone 9 — Extensions + local AI (baseline)
- **Extensions:** app-data manifests `extensions/*/orbit-extension.json`, list/enable state in SQLite, scaffold metadata; no unrestricted untrusted execution/sandbox runtime yet.
- **Local AI:** optional, disabled by default, localhost-only endpoint; SQLite config; Ollama-compatible model discovery/check/generate; grounded tasks (explain code/error, suggest refactor, draft commit, generate docs, custom) using explicit context (selection/file excerpt, git status/diff when available, LSP session info, pasted errors). Streaming/cancel and review-before-apply safeguards included. No cloud/paid APIs, no auto model downloads.
- **Deferred:** extension sandbox/activation runtime, full LSP diagnostic payloads, patch/diff preview apply, local evals/hardware benchmarks, permission-safe fine-tuning workflow.

## Milestone 10 — Packaging/CI/testing (baseline + honest gaps)
- GitHub Actions workflows: `ci.yml`, `release.yml` (native-runner matrix via `tauri-apps/tauri-action`, draft release; requires GitHub environment/secrets to execute).
- Docs: installation/testing/updates/local-ai/architecture/progress; `scripts/checksums.sh`; `dev-clean.sh`/`dev.sh` for stale port 1420 recovery.
- Opt-in updater scaffolding: Tauri updater/process plugins, capabilities, inactive config with `sciversesummitstfrancis-coder/orbit-ide` endpoint + public key placeholder wiring; requires signed releases/CI secrets to function.
- **Deferred (cannot honestly complete in this session):** producing/testing Windows/macOS/Linux installers/DMG/RPM/DEB/AppImage artifacts on each target, running GitHub Actions on real runners, notarization/signing, end-to-end updater verification, comprehensive automated tests.

## Verification (latest local)
- `cargo check --manifest-path src-tauri/Cargo.toml`: pass.
- `npx tsc --noEmit`: pass.
- Previous verified in session history: `npm run typecheck`, `npm run build`, `cargo test` (0 tests), debug Tauri build on Fedora host. Re-run full checks before release claims.

## Command Receipts (new differentiator baseline)
- Local SQLite `receipts` table records file save, git command, terminal create/kill, and local AI task metadata (no cloud, capped ~2000 rows).
- Bottom panel **Receipts** tab provides category/search/workspace filters, detail inspection, copy, open-file, and confirm-before-replay for git commands.
- Privacy/safety: no keystrokes, PTY output, full file contents, prompts, or model responses stored by default. See `docs/command-receipts.md`.

## Workspace Time Machine & Task Capsules (new differentiator baselines)
- **Time Machine:** local SQLite `snapshots` for save/before-save/draft history; periodic dirty draft capture (desktop) and startup draft recovery prompt; panel preview/restore-to-editor (unsaved)/copy/delete.
- **Task Capsules:** local SQLite `capsules` store named task context (workspace, open files metadata, active file, selection, lightweight git summary, note); panel capture/inspect/restore/copy/delete.
- Privacy/safety: local-only, no cloud. Capsules do not store unsaved edits or secrets; Time Machine stores local snapshot content for recovery/history. See `docs/time-machine-capsules.md`.

## Mission Control / Trust Radar / Atlas / Replay / HUD (differentiator baselines)
- **Mission Control:** local timeline + error incident detection from receipts/snapshots; read-only.
- **Trust Radar:** bounded local heuristic scan (active/common config files, recent receipts) for secret-like/destructive/auth-risk signals; on-demand, no cloud.
- **Offline Codebase Atlas:** bounded heuristic file/symbol/import index + impact-radius query; opens files in editor; no embeddings/cloud.
- **Task Replay Sandbox:** capsule-to-checklist replay plan; file opens are read operations, git/commands require explicit confirmation.
- **Energy/Latency HUD:** local metrics from receipt durations and recent local AI runs; no telemetry.
- See `docs/differentiators.md`.
