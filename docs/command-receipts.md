# Command Receipts (ORBIT differentiator)

Command Receipts are ORBIT's local, privacy-preserving action timeline. They help answer “what did ORBIT do?” without cloud telemetry.

## What is recorded (local SQLite `receipts` table)
- **file/save** — saved path + byte count (not file contents).
- **git/run** — git subcommand args, output/error preview, workspace, duration.
- **terminal/create|kill** — shell/cwd/id metadata (never terminal keystrokes or PTY output).
- **ai/run_task** — task type, model, response size, duration (not prompts/model output by default).

All receipts are stored in the app data SQLite DB (`orbit.db`) and capped to the newest ~2000 rows.

## UI
Bottom panel → **Receipts** tab:
- filter by category, search summary/action/detail, scope to current workspace
- inspect JSON detail
- **Open / Replay**: opens file paths; re-runs git commands **only after confirmation** in the current workspace; otherwise copies details

## Safety
- No cloud sync, no paid APIs, no silent uploads.
- Keystrokes, full file contents, prompts, and model responses are not stored by default.
- Destructive replay is intentionally limited; git replay requires explicit confirmation.
