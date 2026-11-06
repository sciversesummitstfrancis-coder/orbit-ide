import { useEffect, useState } from "react";
import { hudApi } from "../services/orbit-extras";
import { useWorkspace } from "../store/workspace";
export default function HudPanel() {
  const ws = useWorkspace(); const [data, setData] = useState<any>(null);
  async function load() { try { setData(await hudApi.metrics(ws.root)); } catch {} }
  useEffect(() => { void load(); }, [ws.root]);
  return <div style={{ height:"100%", overflow:"auto", padding:10 }}>
    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}><strong>Energy / Latency HUD</strong><span style={{ fontSize:11, color:"var(--text-faint)" }}>Local metrics from receipts (no cloud)</span><button className="btn" type="button" onClick={()=>void load()}>Refresh</button></div>
    {data ? <>
      <div className="section-label">OVERVIEW</div>
      <div style={{ fontSize:12 }}>Receipts: {data.receipt_count || 0} · AI samples: {data.ai?.samples || 0} · AI avg duration: {Math.round(data.ai?.avg_duration_ms || 0)} ms</div>
      <div className="section-label">COMMAND DURATION (INSTRUMENTED)</div>
      {(data.command_duration_stats||[]).map((s:any,i:number)=><div key={i} className="tree-row" style={{ cursor:"default" }}><span className="tree-name">{s.category}</span><span style={{ marginLeft:"auto", fontSize:11, color:"var(--text-faint)" }}>{Math.round(s.avg_duration_ms)} ms avg · {s.count}</span></div>)}
      <div className="section-label">RECENT LOCAL AI</div>
      {(data.ai?.recent||[]).slice(0,12).map((r:any,i:number)=><div key={i} style={{ fontSize:11, color:"var(--text-faint)", padding:"2px 0" }}>{new Date(r.ts).toLocaleTimeString()} · {r.status} · {r.duration_ms ?? "?"} ms · {r.detail?.task || "task"} · {r.detail?.model || ""}</div>)}
      <div style={{ fontSize:11, color:"var(--text-faint)", marginTop:8 }}>{data.scope}</div>
    </> : <div style={{ fontSize:12, color:"var(--text-faint)", marginTop:8 }}>No metrics yet.</div>}
  </div>;
}
