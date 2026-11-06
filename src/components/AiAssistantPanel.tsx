import { useEffect, useState } from "react";
import { m9Api, type AiConfig, type AiTask } from "../services/orbit";
import { useWorkspace } from "../store/workspace";

const TASKS: { id: AiTask; label: string; hint: string }[] = [
  { id: "explain_code", label: "Explain Code", hint: "Uses active file excerpt." },
  { id: "explain_error", label: "Explain Error", hint: "Uses error text + active context." },
  { id: "suggest_refactor", label: "Suggest Refactor", hint: "Advisory; review before applying." },
  { id: "draft_commit", label: "Draft Commit", hint: "Uses Git summary context." },
  { id: "generate_docs", label: "Generate Docs", hint: "Uses active file excerpt." },
  { id: "custom", label: "Custom", hint: "Your prompt + local context." },
];

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

  async function saveCfg() {
    setBusy(true);
    try { await m9Api.aiSetConfig(cfg); setOut("Saved local AI config. No cloud endpoint is used."); }
    catch (e) { setOut(String(e)); } finally { setBusy(false); }
  }
  async function loadModels() {
    setBusy(true);
    try { const m = await m9Api.aiListModels(); setModels(m); setOut(m.length ? `Found ${m.length} local model(s).` : "No models found at local endpoint."); }
    catch (e) { setOut(String(e)); } finally { setBusy(false); }
  }
  async function run() {
    setBusy(true);
    const gitSummary = ws.git ? `repo=${ws.git.is_repo} branch=${ws.git.branch || ""} changes=${ws.git.changed.length}\n${ws.git.changed.slice(0, 25).map((c) => `${c.staged ? "S" : " "} ${c.status} ${c.path}`).join("\n")}` : "";
    try {
      const r = await m9Api.aiRunTask({
        task, prompt, error_text: errorText,
        active_path: active?.path || null,
        active_content: active?.content?.slice(0, 16000) || null,
        git_summary: gitSummary || null,
      });
      setOut(typeof r?.response === "string" ? r.response : JSON.stringify(r, null, 2));
    } catch (e) { setOut(String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="empty-state" style={{ padding: 12, overflow: "auto", height: "100%", maxWidth: 760 }}>
      <div className="section-label">ORBIT LOCAL ASSISTANT</div>
      <p style={{ fontSize: 12 }}>Grounded local help for ORBIT: active file, Git summary, and error text you choose to send. Disabled by default; local endpoint only (127.0.0.1/localhost). No paid/cloud API. Output is advisory — review before applying changes.</p>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", fontSize: 12 }}><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Enable local AI</label>
      <div style={{ display: "grid", gap: 8 }}>
        <input value={cfg.endpoint} onChange={(e) => setCfg({ ...cfg, endpoint: e.target.value })} placeholder="http://127.0.0.1:11434" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <input list="orbit-local-models" value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} placeholder="model (e.g. qwen2.5-coder:3b, llama3.2, deepseek-coder)" style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} />
          <button className="btn" type="button" disabled={busy} onClick={loadModels}>Load Models</button>
        </div>
        <datalist id="orbit-local-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn" type="button" disabled={busy} onClick={saveCfg}>Save Config</button><span style={{ fontSize: 11, color: "var(--text-faint)" }}>Provider: local Ollama-compatible `/api/generate`.</span></div>
      </div>
      <div className="section-label">TASK</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{TASKS.map((t) => <button key={t.id} type="button" className={`btn ${task === t.id ? "primary" : ""}`} onClick={() => setTask(t.id)} title={t.hint}>{t.label}</button>)}</div>
      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>Context: {active ? active.path : "no active file"} {ws.git?.is_repo ? `· git ${ws.git.branch || "detached"}` : ""}</div>
      <div className="section-label">PROMPT / ERROR CONTEXT (OPTIONAL)</div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Extra instructions (optional)" style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10 }} />
      <textarea value={errorText} onChange={(e) => setErrorText(e.target.value)} rows={3} placeholder="Paste error/terminal/diagnostic text for Explain Error (optional)" style={{ width: "100%", marginTop: 8, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10 }} />
      <div style={{ marginTop: 8 }}><button className="btn primary" type="button" disabled={busy || !cfg.enabled} onClick={run}>Run Local Assistant</button></div>
      {out ? <pre className="panel-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{out}</pre> : null}
    </div>
  );
}
