# ORBIT AI (Local, Practical v1)

ORBIT AI is ORBIT’s **optional local coding assistant**. It is **not** a from-scratch foundation model and does **not** claim to be better than all online coding agents overall. It is designed to be useful for private, on-device ORBIT workflows.

## Principles
- **Optional / off by default.** User enables explicitly.
- **Local endpoint only:** `127.0.0.1`, `localhost`, `[::1]`. No paid or cloud API required or auto-configured.
- **No silent downloads:** ORBIT never downloads language servers or AI models.
- **Grounded context:** only user-chosen local context is sent (Monaco selection or active file excerpt, Git status summary, pasted error/diagnostic text, task/prompt).
- **Advisory:** responses are suggestions. Review before applying. “Apply Suggestion” replaces the active editor buffer only after confirmation and does not save to disk until the user saves.

## Current v1 features
- Settings UI: enable/disable, local endpoint/model config, model discovery (Ollama-compatible `/api/tags`), persisted in SQLite.
- Tasks: Explain Code, Explain Error, Suggest Refactor, Draft Commit, Generate Docs, Custom.
- Context wiring: Monaco selection capture, active file excerpt, structured Git status summary, optional pasted error text.
- Local provider API: Ollama-compatible `/api/generate` (`stream:false` baseline).

## Good fit
- Explain selected code / local behavior.
- Explain pasted terminal, compiler, or diagnostic errors.
- Draft commit messages from visible Git changes.
- Suggest minimal refactors or docs (review required).

## Hardware guidance
Target baseline includes modest hardware (e.g. i5-6200U / 8 GB). Prefer small local coding models and concise context. Large models may be slow or fail on limited RAM.

## Next steps (not implemented)
- True streaming/cancel tokens in UI.
- Structured LSP diagnostics and full diff hunks as context.
- Safer patch-apply flow (unified diff/selection patch, not whole-file replacement where avoidable).
- Runtime detection for Ollama without auto-install/download.
- Local eval suite (latency, RAM, quality) on target hardware.
- Fine-tuning/distillation only with permission-safe/licensed data and measured results.
