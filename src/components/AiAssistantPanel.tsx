import { useEffect, useRef, useState } from "react";
import Collapsible from "./Collapsible";
import { m9Api, orbit, type AiConfig, type AiTask } from "../services/orbit";
import { useWorkspace } from "../store/workspace";

const TASKS: { id: AiTask; label: string; hint: string }[] = [
  { id: "explain_code", label: "Explain Code", hint: "Uses selection or active file excerpt." },
  { id: "explain_error", label: "Explain Error", hint: "Uses error text + local context." },
  { id: "suggest_refactor", label: "Suggest Refactor", hint: "Advisory; review before applying." },
  { id: "draft_commit", label: "Draft Commit", hint: "Uses git status + diff context." },
  { id: "generate_docs", label: "Generate Docs", hint: "Uses selection or active file excerpt." },
  { id: "custom", label: "Custom", hint: "Your prompt + local context." },
];

function extractFenced(text: string): string | null {
  const blocks = [...text.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((m) => m[1]?.trim()).filter(Boolean) as string[];
  return blocks.length ? blocks.sort((a, b) => b.length - a.length)[0] || null : null;
}
function normalize(s: string) { return s.replace(/\r\n/g, "\n"); }
function replaceSelection(base: string, sel: string, replacement: string) {
  const b = normalize(base), s = normalize(sel), r = normalize(replacement), idx = b.indexOf(s);
  return idx < 0 ? null : b.slice(0, idx) + r + b.slice(idx + s.length);
}

export default function AiAssistantPanel() {
  const ws = useWorkspace();
  const active = ws.files.find((f) => f.path === ws.activePath) || null;
  const [cfg, setCfg] = useState<AiConfig>({ enabled: false, provider: "ollama", endpoint: "http://127.0.0.1:11434", model: "" });
  const [models, setModels] = useState<string[]>([]);
  const [runtime, setRuntime] = useState<any>(null);
  const [task, setTask] = useState<AiTask>("explain_code");
  const [prompt, setPrompt] = useState("");
  const [errorText, setErrorText] = useState("");
  const [includeDiff, setIncludeDiff] = useState(true);
  const [includeFile, setIncludeFile] = useState(true);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const streamIdRef = useRef<string | null>(null);
  const outRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => { m9Api.aiGetConfig().then(setCfg).catch(() => {}); }, []);
  useEffect(() => {
    let un: (() => void) | undefined;
    m9Api.onAiChunk((p) => {
      if (!streamIdRef.current || p.id !== streamIdRef.current) return;
      if (p.error) setOut((o) => (o ? o + "\n\n" : "") + `[${p.error}]`);
      if (p.chunk) setOut((o) => o + p.chunk);
      if (p.done || p.error) { setBusy(false); setStreamId(null); streamIdRef.current = null; }
    }).then((u) => (un = u)).catch(() => {});
    return () => { un?.(); };
  }, []);
  useEffect(() => { if (busy && outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; }, [out, busy]);

  async function saveCfg() { setBusy(true); try { await m9Api.aiSetConfig(cfg); setOut("Saved ORBIT AI config. Local endpoint only; no cloud/paid API; no auto model downloads."); } catch (e) { setOut(String(e)); } finally { setBusy(false); } }
  async function checkRuntime() { setBusy(true); try { const r = await m9Api.aiCheckRuntime(); setRuntime(r); setModels(Array.isArray(r?.models) ? r.models : []); setOut(JSON.stringify(r, null, 2)); } catch (e) { setOut(String(e)); } finally { setBusy(false); } }
  async function loadModels() { setBusy(true); try { const m = await m9Api.aiListModels(); setModels(m); setOut(m.length ? `Found ${m.length} local model(s).` : "No models found at local endpoint."); } catch (e) { setOut(String(e)); } finally { setBusy(false); } }
  async function buildContext() {
    let git_summary = "", git_diff = "", diagnostics = "";
    if (ws.root) try {
      const s = await orbit.gitStatus(ws.root);
      git_summary = `repo=${s.is_repo} branch=${s.branch || ""} changed=${s.changed.length}\n${s.changed.slice(0, 35).map((c) => `${c.staged ? "S" : " "} ${c.status} ${c.path}`).join("\n")}`;
      if (includeDiff && s.is_repo) { try { git_diff = await orbit.gitRun(ws.root, ["diff", "--unified=3", "--no-color", "--", "."]); } catch {} if (!git_diff.trim()) try { git_diff = await orbit.gitRun(ws.root, ["diff", "--cached", "--unified=3", "--no-color", "--", "."]); } catch {} }
    } catch {}
    try { const servers = await orbit.lspList(); diagnostics = servers.length ? `Running/configured LSP sessions: ${servers.map((s) => `${s.id}:${s.language}(${s.command})`).join(", ")}. Full Monaco/LSP diagnostic protocol wiring pending; paste diagnostics in Error Context if needed.` : "No active LSP sessions."; } catch { diagnostics = "LSP session info unavailable."; }
    const sel = ws.selection?.path === active?.path ? ws.selection?.text : null;
    return { task, prompt, error_text: errorText, active_path: active?.path || null, active_content: includeFile ? active?.content?.slice(0, 16000) || null : null, selection: sel?.slice(0, 12000) || null, git_summary: git_summary || null, git_diff: git_diff?.slice(0, 12000) || null, diagnostics };
  }
  async function run(stream: boolean) {
    setBusy(true); setOut(""); setOutputExpanded(false);
    try { const ctx = await buildContext(); if (!stream) { const r = await m9Api.aiRunTask(ctx); setOut(typeof r?.response === "string" ? r.response : JSON.stringify(r, null, 2)); setBusy(false); } else { const id = await m9Api.aiStreamTask(ctx); streamIdRef.current = id; setStreamId(id); } }
    catch (e) { setOut(String(e)); setBusy(false); setStreamId(null); streamIdRef.current = null; }
  }
  async function cancel() { if (streamId) await m9Api.aiCancel(streamId).catch(() => {}); }
  function applySuggestion() {
    if (!active) return setOut((o) => o + "\n\nNo active file to apply to.");
    const suggestion = extractFenced(out); if (!suggestion) return setOut((o) => o + "\n\nNo fenced code block found. Review manually.");
    const sel = ws.selection?.path === active.path ? ws.selection.text : null;
    let next: string | null = null, mode = "file";
    if (sel?.trim()) { next = replaceSelection(active.content, sel, suggestion); if (next != null) mode = "selection"; }
    if (next == null) next = suggestion;
    if (!window.confirm(`${mode === "file" ? "Replace entire active editor buffer" : "Replace captured selection"} in ${active.name}? Not saved until Save (Ctrl/Cmd+S).`)) return;
    ws.updateContent(active.path, next); setOut((o) => o + `\n\nApplied (${mode}) to editor buffer: ${active.name}. Review, then Save.`);
  }
  async function copyOut() { try { await navigator.clipboard.writeText(out); } catch {} }

  const selectionReady = !!ws.selection?.text && ws.selection.path === active?.path;
  return (
    <div className="ai-panel">
      <div className="section-label" style={{ marginTop: 0 }}>ORBIT AI (LOCAL)</div>
      <p style={{ fontSize: 12, marginTop: 0 }}>Grounded local assistant. Localhost-only, off by default, no cloud/paid APIs, no auto downloads. Advisory — review before applying.</p>

      <Collapsible title="Provider & Model" defaultOpen={!cfg.enabled || !cfg.model} right={<span style={{ fontSize: 11, color: runtime?.ok ? "var(--success)" : "var(--text-faint)" }}>{runtime ? (runtime.ok ? "runtime OK" : "runtime unavailable") : ""}</span>}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "0 0 8px", fontSize: 12 }}><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Enable ORBIT AI</label>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={cfg.endpoint} onChange={(e) => setCfg({ ...cfg, endpoint: e.target.value })} placeholder="http://127.0.0.1:11434" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} />
          <div style={{ display: "flex", gap: 8 }}><input list="orbit-local-models" value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} placeholder="local model (Ollama-compatible)" style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} /><button className="btn" type="button" disabled={busy} onClick={loadModels}>Load Models</button></div>
          <datalist id="orbit-local-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn" type="button" disabled={busy} onClick={saveCfg}>Save Config</button><button className="btn" type="button" disabled={busy} onClick={checkRuntime}>Check Runtime</button></div>
        </div>
      </Collapsible>

      <Collapsible title="Task & Context" defaultOpen right={<span style={{ fontSize: 11, color: "var(--text-faint)" }}>{selectionReady ? "selection" : active ? "active file" : "no file"}</span>}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{TASKS.map((t) => <button key={t.id} type="button" className={`btn ${task === t.id ? "primary" : ""}`} onClick={() => setTask(t.id)} title={t.hint}>{t.label}</button>)}</div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>Context: {active ? active.path : "no active file"} {selectionReady ? "· selection" : ""} {ws.git?.is_repo ? `· git ${ws.git.branch || "detached"}` : ""}</div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 6 }}><input type="checkbox" checked={includeFile} onChange={(e) => setIncludeFile(e.target.checked)} /> Include active file/selection excerpt</label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={includeDiff} onChange={(e) => setIncludeDiff(e.target.checked)} /> Include git diff context (when available)</label>
      </Collapsible>

      <Collapsible title="Prompt & Error Details" defaultOpen={false}>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Extra instructions (optional)" style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10 }} />
        <textarea value={errorText} onChange={(e) => setErrorText(e.target.value)} rows={4} placeholder="Paste error/terminal/diagnostic text (optional)" style={{ width: "100%", marginTop: 8, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10 }} />
      </Collapsible>

      <div className="ai-actions">
        <button className="btn primary" type="button" disabled={busy || !cfg.enabled} onClick={() => run(true)}>Run (Stream)</button>
        <button className="btn" type="button" disabled={busy || !cfg.enabled} onClick={() => run(false)}>Run (Once)</button>
        <button className="btn" type="button" disabled={!streamId} onClick={cancel}>Cancel</button>
        <button className="btn" type="button" disabled={busy || !out || !active} onClick={applySuggestion} title="Review/apply fenced suggestion (selection or file buffer; not saved until Save)">Apply Suggestion</button>
      </div>

      <Collapsible title="Response" defaultOpen={true} right={<span style={{ display: "flex", gap: 6 }}><button className="icon-btn" type="button" title="Copy response" onClick={copyOut} disabled={!out}>⎘</button><button className="icon-btn" type="button" title={outputExpanded ? "Compact" : "Expand"} onClick={() => setOutputExpanded((v) => !v)}>{outputExpanded ? "▴" : "▾"}</button><button className="icon-btn" type="button" title="Clear" onClick={() => setOut("")}>×</button></span>}>
        <pre ref={outRef} className={`panel-body ai-output ${outputExpanded ? "expanded" : ""}`}>{out || (busy ? "Waiting for local model…" : "Response will appear here. Use Check Runtime if the local provider is unavailable.")}</pre>
      </Collapsible>
    </div>
  );
}
