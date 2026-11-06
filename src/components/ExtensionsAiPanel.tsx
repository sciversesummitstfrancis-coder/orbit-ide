import { useEffect, useState } from "react";
import { m9Api, type ExtensionInfo } from "../services/orbit";
import AiAssistantPanel from "./AiAssistantPanel";

export default function ExtensionsAiPanel({ mode }: { mode: "extensions" | "ai" }) {
  const [exts, setExts] = useState<ExtensionInfo[]>([]);
  const [scaffold, setScaffold] = useState<any>(null);

  async function load() {
    setExts(await m9Api.extensionsList().catch(() => []));
    setScaffold(await m9Api.extensionsScaffold().catch(() => null));
  }
  useEffect(() => { if (mode === "extensions") void load(); }, [mode]);

  if (mode === "ai") return <AiAssistantPanel />;

  return (
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
}
