import { useEffect, useState } from "react";
import { missionApi } from "../services/orbit-extras";
import { useWorkspace } from "../store/workspace";
function fmt(ts: number) { try { return new Date(ts).toLocaleTimeString(); } catch { return ""; } }
export default function MissionPanel() {
  const ws = useWorkspace();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  async function load() { try { setData(await missionApi.timeline(ws.root, 120)); } catch (e) { setMsg(String(e)); } }
  useEffect(() => { void load(); }, [ws.root]);
  const incidents = data?.incidents || []; const events = data?.events || [];
  return <div style={{ height: "100%", overflow: "auto", padding: 10 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>Mission Control</strong><span style={{ fontSize: 11, color: "var(--text-faint)" }}>Local incident timeline (receipts + snapshots)</span><button className="btn" type="button" onClick={() => void load()}>Refresh</button></div>
    {msg ? <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{msg}</div> : null}
    <div className="section-label">INCIDENTS ({incidents.length})</div>
    {incidents.length ? incidents.map((i: any) => <div key={i.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 8, marginBottom: 8, background: "var(--bg-2)" }}><div style={{ display: "flex", gap: 8 }}><strong style={{ fontSize: 12 }}>{i.title}</strong><span style={{ fontSize: 11, color: "var(--text-faint)" }}>{fmt(i.ts)}</span></div><div style={{ fontSize: 12 }}>{i.summary}</div><div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Actions: {(i.suggested_actions||[]).join(" ")}</div></div>) : <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No recent error incidents detected.</div>}
    <div className="section-label">TIMELINE ({events.length})</div>
    {events.slice(0, 80).map((e: any, idx: number) => <div key={idx} className="tree-row" style={{ cursor: "default" }}><span className="tree-glyph ts" style={{ color: e.status === "error" ? "var(--danger)" : undefined }}>{(e.category||"evt").slice(0,3).toUpper()}</span><span className="tree-name" title={e.summary}>{fmt(e.ts)} · {e.summary}</span><span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-faint)" }}>{e.source}</span></div>)}
  </div>;
}
