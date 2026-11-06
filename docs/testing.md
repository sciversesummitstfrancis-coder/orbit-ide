# ORBIT IDE Testing & Verification

## Automated checks (current)
- **Frontend:** `npm run typecheck` (`tsc --noEmit`), `npm run build` (`tsc && vite build`).
- **Rust:** `cd src-tauri && cargo check`; `cargo test` (add unit/integration tests as services mature).
- **Desktop build sanity:** `npx tauri build --debug --no-bundle`.

## Manual smoke tests (per milestone/release)
1. Launch app (`npm run tauri dev` or packaged artifact).
2. Open Folder dialog, browse tree, open file, edit in Monaco, save (`Ctrl/Cmd+S`), confirm dirty indicator clears.
3. Confirm Git status/branch appears for a repo; test Git panel status/history/diff/stage/commit (use a safe test repo).
4. Open Terminal tab, confirm shell prompt, run commands, resize window/panel, create/kill session.
5. Verify LSP panel starts/stops configured server (no auto-download); handle missing server errors.
6. Verify recents/session restore after restart (desktop app data/SQLite).
7. Verify Extensions manifest listing (app-data/extensions) and local AI config rejects non-local endpoints.

## Release policy
- Do **not** claim `.exe/.deb/.rpm/.AppImage/.dmg` artifacts work without building and testing on the target platform/arch.
- Publish SHA-256 checksums (`scripts/checksums.sh`) and explicit platform test status in release notes.
- Treat unsigned macOS/Windows artifacts as development builds unless signing/notarization is confirmed.
