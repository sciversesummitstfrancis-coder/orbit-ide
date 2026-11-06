# ORBIT IDE Installation (Release Guide)

> Verify checksums before installing. Do not treat artifacts as production-ready until they have been built and tested on the target OS/architecture.

## Linux
- **DEB (Debian/Ubuntu):** `sudo apt install ./ORBIT*.deb` (or `sudo dpkg -i ...`)
- **RPM (Fedora/RHEL):** `sudo dnf install ./ORBIT*.rpm`
- **AppImage:** `chmod +x ORBIT*.AppImage && ./ORBIT*.AppImage`
- **Flatpak:** package/manifest support is planned; verify availability per release.

Runtime/build prerequisites vary by distro. For development, install Tauri 2 Linux prerequisites (WebKitGTK 4.1, libsoup3, GTK3, librsvg2, appindicator where used).

## Windows
- **Installer (.exe):** run the NSIS/WiX installer artifact produced by Tauri bundler.
- **Portable:** if provided, extract and run `ORBIT IDE.exe`. Verify the release notes for the exact artifact type.

## macOS
- **Apple Silicon / Intel DMG:** open DMG and drag ORBIT IDE to Applications.
- macOS may require Gatekeeper approval for unsigned builds; signed/notarized release status must be stated in release notes.

## Checksums
Generate or verify SHA-256 checksums:
```bash
./scripts/checksums.sh ./release-artifacts
sha256sum -c SHA256SUMS.txt  # Linux
shasum -a 256 -c SHA256SUMS.txt  # macOS
```

## Updates
Auto-update is opt-in and disabled by default. See `docs/updates.md` for Tauri updater signing keys, endpoints, and release setup. The source config ships with the updater inactive until real release infrastructure is configured.

## Local development
```bash
cd orbit-ide
npm install
npm run tauri dev
# or, if port 1420 is held by a stale ORBIT dev process:
npm run dev:desktop   # stops stale ORBIT vite/tauri debug processes, then runs tauri dev
npm run dev:clean     # only stop stale ORBIT dev processes
```
Requires Rust toolchain, Node.js/npm, Git, and platform Tauri prerequisites.
