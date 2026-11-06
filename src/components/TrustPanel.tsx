import { useState } from "react";
import { trustApi } from "../services/orbit-extras";
import { useWorkspace } from "../store/workspace";
export default function TrustPanel() {
  const ws = useWorkspace();
  const active = ws.files.find((f) => f.path === ws.activePath);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function scan() { setBusy(true); try { setData(await trustApi.scan({ workspace: ws.root, active_path: active?.path || null, active_content: active?.content || null })); } finally { setBusy(false); } }
  return <div style={{ height: "100%", overflow: "auto", padding: 10 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>Trust Radar</strong><span style={{ fontSize: 11, color: "var(--text-faint)" }}>Bounded local risk scan (no cloud)</span><button className="btn primary" type="button" onClick={() => void scan()} disabled={busy}>{busy ? "Scanning…" : "Scan"}</button></div>
    <p style={{ fontSize: 12 }}>Scans active file content, common config files, and recent receipts for risky patterns (secrets, destructive commands, auth errors). Heuristic evidence only — verify before action.</p>
    {data ? <><div className="section-label">SUMMARY</div><div style={{ fontSize: 12 }}>High: {data.summary?.high || 0} · Medium: {data.summary?.medium || 0} · Total: {data.summary?.total || 0}</div><div className="section-label">FINDINGS</div>{(data.findings||[]).length ? (data.findings||[]).map((f:any,i:number)=><div key={i} style={{ border:"1px solid var(--border-subtle)", borderRadius:8, padding:8, marginBottom:8 }}><div style={{ fontSize:12 }}><strong style={{ color:f.severity==="high"?"var(--danger)":"var(--text)" }}>[{f.severity}]</strong> {f.title}</div><div style={{ fontSize:11, color:"var(--text-faint)" }}>{f.evidence}{f.path?` · ${f.path}`:""}</div><div style={{ fontSize:12, marginTop:4 }}>{f.recommendation}</div></div>) : <div style={{ fontSize:12, color:"var(--text-faint)" }}>No findings from bounded local heuristics.</div>}<div style={{ fontSize:11, color:"var(--text-faint)", marginTop:8 }}>{data.scope}</div></> : null}
  </div>;
}
