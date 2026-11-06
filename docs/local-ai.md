# ORBIT Local AI (Practical Direction)

ORBIT does **not** train a frontier foundation model from scratch. That path is unrealistic for this project (data/compute/alignment/cost). ORBIT also does **not** claim to be better than all online coding agents overall.

## What ORBIT implements instead
A **local-first, grounded assistant** that can be more useful for specific ORBIT workflows:
- **Optional and off by default.**
- **Local endpoint only:** `127.0.0.1` / `localhost` / `[::1]`. No paid or cloud API required or auto-configured.
- **Grounded context (user-chosen):** active file excerpt, Git summary, pasted error/diagnostic text, and task-specific prompt.
- **Advisory output:** suggestions must be reviewed before applying; the model is not trusted as execution authority.
- **Model-agnostic local runtime:** current baseline targets an Ollama-compatible API (`/api/generate`, `/api/tags`). Users install/run their chosen local model runtime; ORBIT never silently downloads models.

## Good tasks for local models
- Explain selected code or active file behavior.
- Explain a pasted error/terminal/diagnostic message.
- Suggest a minimal, safe refactor.
- Draft a commit message from visible Git context.
- Generate concise docs/comments for local code.

## Hardware reality
On modest hardware (target baseline i5-6200U / 8 GB), prefer small local coding models and concise context. Large models may be slow or unusable; task scoping and truncation matter.

## Future improvements
- Selection-aware prompts from Monaco.
- Diagnostics/LSP and structured Git diff context.
- Streaming responses and cancellation.
- Explicit review/apply flow for suggested edits.
- Local benchmark suite for latency/quality on target hardware.
- Optional fine-tuning/distillation workflow only with permission-safe/licensed data.
