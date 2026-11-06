# Workspace Time Machine & Task Capsules

Local-first, SQLite-backed features. No cloud, no paid APIs, no silent uploads.

## Workspace Time Machine
- **Storage:** `snapshots` table in app data `orbit.db`.
- **Recorded:** file `save` and `before-save` snapshots during `fs_write_file`; periodic `draft` captures (desktop) for dirty editor buffers; startup recovery prompt can restore latest draft snapshots as unsaved buffers.
- **Limits:** dedupes identical consecutive content per path/kind; keeps recent snapshots per path and caps total rows.
- **UI:** bottom panel **Time Machine** tab — active-file/workspace scope, preview, Restore to Editor (unsaved), copy, delete.
- **Safety:** restoring never overwrites disk until user saves. Snapshot content is stored locally; avoid using for secrets-sensitive workflows without understanding local DB storage.

## Task Capsules
- **Storage:** `capsules` table in `orbit.db`.
- **Captured context:** name/note, workspace/root, active path, open file paths + dirty flags, editor selection, lightweight git summary (branch/changed/ahead/behind), timestamp.
- **UI:** bottom panel **Capsules** tab — capture, inspect JSON, restore context (reopens files from disk; dirty unsaved edits are not stored), copy/delete.
- **Safety:** capsules store metadata/context, not unsaved edits, terminal keystrokes, or credentials. Use Time Machine for draft recovery.

## Related
- **Command Receipts** remains the local action audit trail (`docs/command-receipts.md`).
