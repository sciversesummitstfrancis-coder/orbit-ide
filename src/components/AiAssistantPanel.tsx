import { useEffect, useState } from "react";
import { m9Api, orbit, type AiConfig, type AiTask } from "../services/orbit";
import { useWorkspace } from "../store/workspace";

const TASKS: { id: AiTask; label: string; hint: string }[] = [
  { id: "explain_code", label: "Explain Code", hint: "Uses selection or active file excerpt." },
  { id: "explain_error", label: "Explain Error", hint: "Uses error text + local context." },
  { id: "suggest_refactor", label: "Suggest Refactor", hint: "Advisory; review before applying." },
  { id: "draft_commit", label: "Draft Commit", hint: "Uses structured git status." },
  { id: "generate_docs", label: "Generate Docs", hint: "Uses selection or active file excerpt." },
  { id: "custom", label: "Custom", hint: "Your prompt + local context." },
];

function extractSuggestion(text: string): string | null {
  const m = text.match(/```[\w-]*\n([\s\S]*?)```/);
  return m?.[1]?.trim() || null;
}

export default function AiAssistantPanel() {
  const ws = useWorkspace();
  const active = ws.files.find((f) => f.path === ws.activePath) || null;
  const [cfg, setCfg] = useState<AiConfig>({ enabled: false, provider: "ollama", endpoint: "http://127.0.0.1:11434", model: "" });
  const [models, setModels] = useState<string[]>([]);
  const [task, setTask] = useState<AiTask>("explain_code");
  const [prompt, setPrompt] = useState("");
  const [errorText, setErrorText] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { m9Api.aiGetConfig().then(setCfg).catch(() => {}); }, []);

  async function saveCfg() { setBusy(true); try { await m9Api.aiSetConfig(cfg); setOut("Saved ORBIT AI config. Local endpoint only; no cloud/paid API is used."); } catch (e) { setOut(String(e)); } finally { setBusy(false); } }
  async function loadModels() { setBusy(true); try { const m = await m9Api.aiListModels(); setModels(m); setOut(m.length ? `Found ${m.length} local model(s).` : "No models found at local endpoint."); } catch (e) { setOut(String(e)); } finally { setBusy(false); } }
  async function gitSummary() {
    if (!ws.root) return "";
    try {
      const s = await orbit.gitStatus(ws.root);
      const lines = s.changed.slice(0, 30).map((c) => `${c.staged ? "S" : " "} ${c.status} ${c.path}`).join("\n");
      return `repo=${s.is_repo} branch=${s.branch || ""} changed=${s.changed.length}\n${lines}`;
    } catch { return ws.git ? `repo=${ws.git.is_repo} branch=${ws.git.branch || ""} changed=${ws.git.changed.length}` : ""; }
  }
  async function run() {
    setBusy(true);
    try {
      const sel = ws.selection?.path === active?.path ? ws.selection?.text : null;
      const r = await m9Api.aiRunTask({
        task, prompt, error_text: errorText,
        active_path: active?.path || null,
        active_content: active?.content?.slice(0, 16000) || null,
        selection: sel?.slice(0, 12000) || null,
        git_summary: (await gitSummary()) || null,
      });
      setOut(typeof r?.response === "string" ? r.response : JSON.stringify(r, null, 2));
    } catch (e) { setOut(String(e)); } finally { setBusy(false); }
  }
  function applySuggestion() {
    if (!active) return setOut((o) => o + "\n\nNo active file to apply to.");
    const suggestion = extractSuggestion(out);
    if (!suggestion) return setOut((o) => o + "\n\nNo fenced code block found to apply. Review the response manually.");
    if (!window.confirm(`Apply suggested code block to ${active.name}? This replaces the entire file in the editor (not saved to disk until you Save).`)) return;
    ws.updateContent(active.path, suggestion);
    setOut((o) => o + `\n\nApplied suggestion to editor buffer: ${active.name}. Review carefully, then Save (Ctrl/Cmd+S).`);
  }

  const selectionReady = !!ws.selection?.text && ws.selection.path === active?.path;
  return (
    <div className="empty-state" style={{ padding: 12, overflow: "auto", height: "100%", maxWidth: 760 }}>
      <div className="section-label">ORBIT AI (LOCAL)</div>
      <p style={{ fontSize: 12 }}>Grounded, optional local assistant. Uses only local context you choose (selection/active file, Git status, pasted errors). Disabled by default; localhost-only endpoint; no paid/cloud API. Advisory only — review before applying.</p>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", fontSize: 12 }}><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Enable ORBIT AI</label>
      <div style={{ display: "grid", gap: 8 }}>
        <input value={cfg.endpoint} onChange={(e) => setCfg({ ...cfg, endpoint: e.target.value })} placeholder="http://127.0.0.1:11434" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <input list="orbit-local-models" value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} placeholder="local model (Ollama-compatible)" style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} />
          <button className="btn" type="button" disabled={busy} onClick={loadModels}>Load Models</button>
        </div>
        <datalist id="orbit-local-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn" type="button" disabled={busy} onClick={saveCfg}>Save Config</button><span style={{ fontSize: 11, color: "var(--text-faint)" }}>Local runtime (e.g. Ollama) must be installed/running; ORBIT never downloads models.</span></div>
      </div>
      <div className="section-label">TASK</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{TASKS.map((t) => <button key={t.id} type="button" className={`btn ${task === t.id ? "primary" : ""}`} onClick={() => setTask(t.id)} title={t.hint}>{t.label}</button>)}</div>
      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>Context: {active ? active.path : "no active file"} {selectionReady ? "· selection captured" : ""} {ws.git?.is_repo ? `· git ${ws.git.branch || "detached"}` : ""}</div>
      <div className="section-label">PROMPT / ERROR CONTEXT (OPTIONAL)</div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Extra instructions (optional)" style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10 }} />
      <textarea value={errorText} onChange={(e) => setErrorText(e.target.value)} rows={3} placeholder="Paste error/terminal/diagnostic text for Explain Error (optional)" style={{ width: "100%", marginTop: 8, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10 }} />
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn primary" type="button" disabled={busy || !cfg.enabled} onClick={run}>Run ORBIT AI</button>
        <button className="btn" type="button" disabled={busy || !out || !active} onClick={applySuggestion} title="Applies first fenced code block to active editor buffer after confirmation">Apply Suggestion (Review)</button>
      </div>
      {out ? <pre className="panel-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{out}</pre> : null}
    </div>
  );
}
