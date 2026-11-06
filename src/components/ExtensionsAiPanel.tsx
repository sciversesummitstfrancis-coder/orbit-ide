import { useEffect, useState } from "react";
import { m9Api, type AiConfig, type ExtensionInfo } from "../services/orbit";

export default function ExtensionsAiPanel({ mode }: { mode: "extensions" | "ai" }) {
  const [exts, setExts] = useState<ExtensionInfo[]>([]);
  const [scaffold, setScaffold] = useState<any>(null);
  const [ai, setAi] = useState<AiConfig>({ enabled: false, provider: "ollama", endpoint: "http://127.0.0.1:11434", model: "" });
  const [prompt, setPrompt] = useState("Explain the selected code or error in plain terms.");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (mode === "extensions") {
      setExts(await m9Api.extensionsList().catch(() => []));
      setScaffold(await m9Api.extensionsScaffold().catch(() => null));
    } else setAi(await m9Api.aiGetConfig().catch(() => ai));
  }
  useEffect(() => { void load(); }, [mode]);

  if (mode === "extensions") return (
    <div className="empty-state" style={{ padding: 12, overflow: "auto", height: "100%" }}>
      <div className="section-label">EXTENSIONS (PERMISSIONED SCAFFOLD)</div>
      <p style={{ fontSize: 12 }}>ORBIT reads manifests from app data <code>extensions/*/orbit-extension.json</code>. Untrusted extensions do not get unrestricted filesystem/process access. Execution sandbox is planned.</p>
      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}><button className="btn" type="button" onClick={() => void load()}>Refresh</button></div>
      {exts.length ? exts.map((e) => (
        <div key={e.manifest.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10, marginBottom: 8, background: "var(--bg-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{e.manifest.name || e.manifest.id}</strong><span className={`status-item pill ${e.enabled ? "" : "warn"}`}>{e.enabled ? "enabled" : "disabled"}</span></div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{e.manifest.description || "No description"} · {e.manifest.version || "0.0.0"}</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Permissions: {(e.manifest.permissions || []).join(", ") || "none declared"}</div>
          <div style={{ marginTop: 8 }}><button className="btn" type="button" onClick={async () => { await m9Api.extensionsSetEnabled(e.manifest.id, !e.enabled); await load(); }}>{e.enabled ? "Disable" : "Enable"}</button></div>
        </div>
      )) : <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No extension manifests found.</p>}
      {scaffold ? <pre className="panel-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{JSON.stringify(scaffold, null, 2)}</pre> : null}
    </div>
  );

  return (
    <div className="empty-state" style={{ padding: 12, overflow: "auto", height: "100%" }}>
      <div className="section-label">OPTIONAL LOCAL AI</div>
      <p style={{ fontSize: 12 }}>Disabled by default. Uses a local endpoint only (localhost/127.0.0.1). No paid or cloud API is required.</p>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", fontSize: 12 }}><input type="checkbox" checked={ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} /> Enable local AI</label>
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <input value={ai.endpoint} onChange={(e) => setAi({ ...ai, endpoint: e.target.value })} placeholder="http://127.0.0.1:11434" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} />
        <input value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} placeholder="model (e.g. qwen2.5-coder, llama3.2)" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }} />
        <button className="btn" type="button" disabled={busy} onClick={async () => { setBusy(true); try { await m9Api.aiSetConfig(ai); setOut("Saved local AI config."); } catch (e) { setOut(String(e)); } finally { setBusy(false); } }}>Save Config</button>
      </div>
      <div className="section-label">TEST PROMPT</div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ width: "100%", maxWidth: 720, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10 }} />
      <div style={{ marginTop: 8 }}><button className="btn primary" type="button" disabled={busy || !ai.enabled} onClick={async () => { setBusy(true); try { const r = await m9Api.aiComplete(prompt); setOut(r?.response || JSON.stringify(r, null, 2)); } catch (e) { setOut(String(e)); } finally { setBusy(false); } }}>Run Local AI</button></div>
      {out ? <pre className="panel-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{out}</pre> : null}
    </div>
  );
}
