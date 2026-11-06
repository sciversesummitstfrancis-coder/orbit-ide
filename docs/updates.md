# ORBIT IDE Updates

ORBIT uses Tauri's updater plugin. **Auto-update is opt-in** and disabled by default.

## Runtime behavior
- Settings → **Updates**: “Check for updates on startup” (stored in SQLite `settings` key `updates.config`).
- Manual “Check for Updates” is always available in Settings.
- The app never silently downloads/installs an update. If an update is found, ORBIT asks for confirmation before `downloadAndInstall()` and restart.
- Missing/placeholder endpoints, keys, or signatures are treated as “not configured”, not a crash.

## Required release configuration
1. **Signing keys:** generate a Tauri updater keypair and keep the private key secret.
   - `npx tauri signer generate -w ~/.tauri/orbit.key` (local, do not commit).
2. **`src-tauri/tauri.conf.json` → `plugins.updater`:**
   - set `active` to `true` for release builds that should check updates.
   - set `pubkey` to the generated **public** key.
   - set `endpoints` to your HTTPS update manifest URL, e.g. GitHub Releases `latest.json`.
3. **CI/build env:** provide `TAURI_SIGNING_PRIVATE_KEY` (and password if used) when building release artifacts with updater metadata.
4. **Release artifacts:** publish platform bundles plus signed updater artifacts/manifests expected by your endpoint (`latest.json` format per Tauri updater docs).

## Security notes
- Only use HTTPS endpoints you control.
- Never commit private signing keys.
- Auto-update must not bypass user consent in normal builds.
- Until release infrastructure is configured, the shipped config remains inactive/placeholder.


## Repo-specific values needed (not committed)
To activate updater releases, replace placeholders in `src-tauri/tauri.conf.json`:
- `plugins.updater.endpoints[0]`: `https://github.com/<OWNER>/<REPO>/releases/latest/download/latest.json`
- `plugins.updater.pubkey`: Tauri updater **public** key (safe to commit once real).
- `plugins.updater.active`: `true` only for builds/releases that should check updates.
Keep the **private** signing key out of git; provide `TAURI_SIGNING_PRIVATE_KEY` in CI.
