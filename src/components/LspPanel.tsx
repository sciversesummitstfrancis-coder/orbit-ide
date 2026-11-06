import { useEffect, useState } from "react";
import { orbit, type LspServerConfig } from "../services/orbit";

const TEMPLATES: LspServerConfig[] = [
  { id: "typescript", language: "typescript", command: "typescript-language-server", args: ["--stdio"], enabled: false },
  { id: "rust", language: "rust", command: "rust-analyzer", args: [], enabled: false },
  { id: "python", language: "python", command: "pylsp", args: [], enabled: false },
  { id: "json", language: "json", command: "vscode-json-language-server", args: ["--stdio"], enabled: false },
];

export default function LspPanel() {
  const [configs, setConfigs] = useState<LspServerConfig[]>(TEMPLATES);
  const [running, setRunning] = useState<LspServerConfig[]>([]);
  const [log, setLog] = useState<string[]>(["LSP is optional and user-configured. ORBIT never downloads language servers automatically."]);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() { try { setRunning(await orbit.lspList()); } catch (e) { setLog((l) => [`${e}`, ...l]); } }
  useEffect(() => {
    void refresh();
    let u1: (() => void) | undefined, u2: (() => void) | undefined, u3: (() => void) | undefined;
    orbit.onLspMessage((p) => setLog((l) => [`${p.server_id} <= ${JSON.stringify(p.message).slice(0, 220)}`, ...l].slice(0, 120))).then((u) => (u1 = u));
    orbit.onLspStderr((p) => setLog((l) => [`${p.server_id} stderr: ${p.line}`, ...l].slice(0, 120))).then((u) => (u2 = u));
    orbit.onLspExit((p) => { setLog((l) => [`${p.server_id || "lsp"} exited`, ...l].slice(0, 120)); void refresh(); }).then((u) => (u3 = u));
    return () => { u1?.(); u2?.(); u3?.(); };
  }, []);

  function setCfg(id: string, patch: Partial<LspServerConfig>) { setConfigs((cs) => cs.map((c) => c.id === id ? { ...c, ...patch } : c)); }
  async function start(c: LspServerConfig) {
    setBusy(c.id);
    try { await orbit.lspStart({ ...c, enabled: true }); setLog((l) => [`started ${c.id} (${c.command})`, ...l]); await refresh(); }
    catch (e) { setLog((l) => [`start ${c.id} failed: ${e}`, ...l]); }
    finally { setBusy(null); }
  }
  async function stop(id: string) {
    setBusy(id);
    try { await orbit.lspStop(id); setLog((l) => [`stopped ${id}`, ...l]); await refresh(); }
    catch (e) { setLog((l) => [`stop ${id} failed: ${e}`, ...l]); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", minHeight: 0 }}>
      <div style={{ borderRight: "1px solid var(--border-subtle)", overflow: "auto", padding: 10 }}>
        <div className="section-label">LANGUAGE SERVERS (MANUAL CONFIG)</div>
        {configs.map((c) => {
          const live = running.find((r) => r.id === c.id);
          return (
            <div key={c.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 10, marginBottom: 8, background: "var(--bg-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong>{c.language}</strong>
                <span className={`status-item pill ${live ? "" : "warn"}`}>{live ? "running" : "stopped"}</span>
              </div>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <input value={c.command} onChange={(e) => setCfg(c.id, { command: e.target.value })} placeholder="command" style={{ background: "var(--bg-1)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "6px 8px" }} />
                <input value={c.args.join(" ")} onChange={(e) => setCfg(c.id, { args: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : [] })} placeholder="args" style={{ background: "var(--bg-1)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "6px 8px" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {!live ? <button className="btn primary" type="button" disabled={busy === c.id} onClick={() => void start(c)}>Start</button> : <button className="btn" type="button" disabled={busy === c.id} onClick={() => void stop(c.id)}>Stop</button>}
              </div>
            </div>
          );
        })}
      </div>
      <pre className="panel-body" style={{ margin: 0, border: 0 }}>{log.join("\n")}</pre>
    </div>
  );
}
