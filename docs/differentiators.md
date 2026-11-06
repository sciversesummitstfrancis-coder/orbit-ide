# ORBIT Differentiators (local-first baselines)

All features below run locally (SQLite + native Rust/Tauri services + React UI), require no cloud/paid APIs, and avoid silent uploads. They are heuristic/baseline implementations designed to be explainable on modest hardware.

## Mission Control / Incident Flight Recorder
- **Backend:** `src-tauri/src/services/mission.rs` (`mission_timeline`) aggregates recent `receipts` + `snapshots` into a timeline and detects simple error incidents with evidence/suggested actions.
- **UI:** bottom panel **Mission** tab (`MissionPanel.tsx`).
- **Safety:** read-only correlation over local data; no command execution.

## Trust Radar
- **Backend:** `src-tauri/src/services/trust.rs` (`trust_scan`) performs bounded local checks: active file/common config files for secret-like patterns, and recent receipts for destructive git/auth-failure signals.
- **UI:** bottom panel **Trust** tab; scans on demand.
- **Safety:** heuristic evidence only; no cloud scanning; bounded file set/size.

## Offline Codebase Atlas
- **Backend:** `src-tauri/src/services/atlas.rs` (`atlas_index`, `atlas_impact`) walks code files (ignoring common build/vendor dirs, capped depth/count/size), extracts lightweight symbol/import lines, and returns search/impact-radius matches.
- **UI:** bottom panel **Atlas** tab with Index/Search and Impact Radius; opens matching files in editor.
- **Safety/perf:** no embeddings/cloud; bounded heuristic index suitable as a baseline for i5-6200U/8GB.

## Task Replay Sandbox
- **Backend:** `src-tauri/src/services/replay.rs` (`replay_plan`) builds a replay checklist from a selected Task Capsule.
- **UI:** bottom panel **Replay** tab; opens file steps and runs git steps only after explicit confirmation.
- **Safety:** deterministic replay is intentionally a **plan/checklist**, not automatic execution. Commands require explicit approval and existing receipt logging.

## Energy / Latency HUD
- **Backend:** `src-tauri/src/services/hud.rs` (`hud_metrics`) summarizes local receipt durations and recent local AI task metrics.
- **UI:** bottom panel **HUD** tab.
- **Safety:** local-only metrics from receipts; no cloud telemetry. Accuracy depends on instrumented actions.

## Integration
- Tauri commands registered in `src-tauri/src/lib.rs`; modules in `src-tauri/src/services/mod.rs`.
- Frontend wrappers: `src/services/orbit-extras.ts`.
- Bottom panel tabs added in `src/App.tsx`.

## Next upgrades
- Mission: richer causal graphs, time-window grouping, receipt-level drill-in links.
- Trust: configurable rules, ignore lists, extension manifest permission audit, clearer severity explanations.
- Atlas: incremental SQLite index, ripgrep-backed search, symbol refs/callers, Monaco jump-to-symbol integration.
- Replay: read-only diff preview, terminal command allowlist, optional isolated temp workspace.
- HUD: process memory/CPU sampling (OS-specific), indexing/model benchmark presets.
