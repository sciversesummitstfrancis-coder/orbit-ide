import { useState } from "react";
import { atlasApi } from "../services/orbit-extras";
import { orbit } from "../services/orbit";
import { useWorkspace } from "../store/workspace";
export default function AtlasPanel() {
  const ws = useWorkspace();
  const [q, setQ] = useState(""); const [data, setData] = useState<any>(null); const [impact, setImpact] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function runIndex() { if (!ws.root) return; setBusy(true); try { setData(await atlasApi.index(ws.root, q, 120)); setImpact(null); } finally { setBusy(false); } }
  async function runImpact() { if (!ws.root || !q.trim()) return; setBusy(true); try { setImpact(await atlasApi.impact(ws.root, q.trim())); } finally { setBusy(false); } }
  async function openPath(path: string) { try { const content = await orbit.readFile(path); const name = path.split(/[/\\]/).pop()||path; ws.openFile({ path, name, content, saved: content }); } catch {} }
  const files = impact?.related_files || data?.files || [];
  return <div style={{ height: "100%", overflow: "auto", padding: 10 }}>
    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}><strong>Offline Codebase Atlas</strong><span style={{ fontSize:11, color:"var(--text-faint)" }}>Local heuristic index (no embeddings/cloud)</span></div>
    <div style={{ display:"flex", gap:8, margin:"8px 0", flexWrap:"wrap" }}><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Symbol/path/import query" style={{ flex:1, minWidth:220, background:"var(--bg-2)", border:"1px solid var(--border-subtle)", borderRadius:8, padding:"6px 8px" }} /><button className="btn" type="button" disabled={!ws.root||busy} onClick={()=>void runIndex()}>Index/Search</button><button className="btn primary" type="button" disabled={!ws.root||busy||!q.trim()} onClick={()=>void runImpact()}>Impact Radius</button></div>
    {!ws.root ? <div style={{ fontSize:12, color:"var(--text-faint)" }}>Open a workspace to index locally.</div> : null}
    {impact ? <div style={{ fontSize:12, marginBottom:8 }}>{impact.note}</div> : data ? <div style={{ fontSize:12, marginBottom:8 }}>Indexed matches: {data.indexed_files} · {data.scope}</div> : null}
    {files.map((f:any)=><button key={f.path} type="button" className="tree-row" style={{ width:"100%", textAlign:"left", background:"transparent", border:0, cursor:"pointer" }} onClick={()=>void openPath(f.path)}><span className="tree-glyph ts">{(f.ext||"").slice(0,2).toUpperCase()||"F"}</span><span className="tree-name" title={f.path}>{f.path.replace(ws.root||"","") || f.path}</span><span style={{ marginLeft:"auto", fontSize:10, color:"var(--text-faint)" }}>{(f.symbols||[]).slice(0,3).join(", ")}</span></button>)}
  </div>;
}
