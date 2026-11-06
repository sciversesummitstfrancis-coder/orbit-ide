import { useEffect, useState } from "react";
import { capsulesApi, type CapsuleMeta } from "../services/capsules";
import { replayApi } from "../services/orbit-extras";
import { orbit } from "../services/orbit";
import { useWorkspace } from "../store/workspace";
export default function ReplayPanel() {
  const ws = useWorkspace();
  const [caps, setCaps] = useState<CapsuleMeta[]>([]); const [id, setId] = useState(""); const [plan, setPlan] = useState<any>(null); const [msg, setMsg] = useState("");
  useEffect(() => { capsulesApi.list(ws.root, 100).then(setCaps).catch(()=>{}); }, [ws.root]);
  async function build() { try { setPlan(await replayApi.plan(id || null, ws.root)); setMsg(""); } catch (e) { setMsg(String(e)); } }
  async function runStep(s:any) {
    try {
      if (s.kind === "file" && s.path) { const content = await orbit.readFile(s.path); const name = s.path.split(/[/\\]/).pop()||s.path; ws.openFile({ path:s.path, name, content, saved: content }); setMsg(`Opened ${s.path}`); }
      else if (s.kind === "git" && Array.isArray(s.command) && ws.root) { if (!window.confirm(`Run git ${s.command.join(" ")}?`)) return; setMsg(await orbit.gitRun(ws.root, s.command.map(String))); }
      else setMsg(s.note || "No executable action for this step.");
    } catch (e) { setMsg(String(e)); }
  }
  return <div style={{ height:"100%", overflow:"auto", padding:10 }}>
    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}><strong>Task Replay Sandbox</strong><span style={{ fontSize:11, color:"var(--text-faint)" }}>Checklist replay; commands require explicit confirmation</span></div>
    <div style={{ display:"flex", gap:8, margin:"8px 0", flexWrap:"wrap" }}><select value={id} onChange={(e)=>setId(e.target.value)} style={{ flex:1, minWidth:220, background:"var(--bg-2)", border:"1px solid var(--border-subtle)", borderRadius:8, padding:"6px 8px" }}><option value="">Select capsule…</option>{caps.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn primary" type="button" onClick={()=>void build()}>Build Plan</button></div>
    {plan?.policy ? <div style={{ fontSize:11, color:"var(--text-faint)", marginBottom:8 }}>{plan.policy}</div> : null}
    {(plan?.plan||[]).map((s:any)=><div key={s.id} style={{ border:"1px solid var(--border-subtle)", borderRadius:8, padding:8, marginBottom:8 }}><div style={{ display:"flex", gap:8, alignItems:"center" }}><strong style={{ fontSize:12 }}>{s.title}</strong><span style={{ fontSize:10, color:"var(--text-faint)" }}>{s.kind}{s.requires_confirm?" · confirm":""}</span><button className="btn" style={{ marginLeft:"auto" }} type="button" onClick={()=>void runStep(s)}>Run Step</button></div><div style={{ fontSize:12 }}>{s.note}</div>{s.command ? <code style={{ fontSize:11 }}>git {s.command.join(" ")}</code> : null}</div>)}
    {msg ? <pre className="panel-body" style={{ margin:0, whiteSpace:"pre-wrap" }}>{msg}</pre> : null}
  </div>;
}
