# ORBIT AI (Local, Practical v1+)

ORBIT AI is ORBIT’s **optional local coding assistant**. It is **not** a from-scratch foundation model and does **not** claim to be better than all online coding agents overall. It is designed for private, on-device ORBIT workflows.

## Principles
- **Optional / off by default.** User enables explicitly.
- **Local endpoint only:** `127.0.0.1`, `localhost`, `[::1]`. No paid or cloud API required or auto-configured.
- **No silent downloads:** ORBIT never downloads language servers, AI models, or runtime providers.
- **Grounded context:** only explicit local context is sent (Monaco selection or active file excerpt, Git status summary, Git diff hunks when requested/available, LSP session info/pasted diagnostics, pasted error text, task/prompt).
- **Advisory:** responses are suggestions. Review before applying.

## Current features
- **Config/runtime:** SQLite-persisted config, local Ollama-compatible endpoints (`/api/tags`, `/api/generate`), **Check Runtime** (reachability + model presence; no auto-install/download).
- **Streaming + cancel:** `Run (Stream)` consumes Ollama NDJSON `response` chunks and emits `ai://chunk` events; **Cancel** is best-effort (server read loop stops on next chunk/line).
- **Tasks:** Explain Code, Explain Error, Suggest Refactor, Draft Commit, Generate Docs, Custom.
- **Context:** Monaco selection capture, active file excerpt, structured Git status, optional Git diff (`git diff` / staged fallback), LSP session info (full Monaco diagnostic protocol wiring still pending), optional pasted error text.
- **Safer apply (review flow):** extracts the largest fenced code block; if a captured selection exists in the active buffer it replaces that selection, otherwise it offers whole-buffer replacement. Requires confirmation and **does not save to disk** until the user saves.

## Hardware guidance
Target baseline includes modest hardware (e.g. i5-6200U / 8 GB). Prefer small local coding models and concise context.

## Next steps
- Full Monaco/LSP diagnostic payload wiring.
- True patch/diff-based apply with preview hunks.
- Stronger provider cancellation semantics where supported.
- Local eval suite (latency, RAM, quality) and permission-safe fine-tuning workflow.
