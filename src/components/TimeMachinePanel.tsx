import { useEffect, useMemo, useState } from "react";
import { tmApi, type Snapshot, type SnapshotMeta } from "../services/timemachine";
import { useWorkspace } from "../store/workspace";

function fmt(ts: number) { try { return new Date(ts).toLocaleString(); } catch { return String(ts); } }

export default function TimeMachinePanel() {
  const ws = useWorkspace();
  const active = ws.files.find((f) => f.path === ws.activePath) || null;
  const [items, setItems] = useState<SnapshotMeta[]>([]);
  const [selected, setSelected] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [scopeActive, setScopeActive] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setBusy(true);
    try { setItems(await tmApi.list({ path: scopeActive && active?.path ? active.path : undefined, workspace: !scopeActive && ws.root ? ws.root : undefined, limit: 120 })); }
    catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [ws.activePath, ws.root, scopeActive]);

  async function openSnapshot(m: SnapshotMeta) {
    setBusy(true); setMsg("");
    try { setSelected(await tmApi.get(m.id)); } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }
  async function restoreToEditor() {
    if (!selected) return;
    const name = selected.path.split(/[/\\]/).filter(Boolean).pop() || selected.path;
    const existing = ws.files.find((f) => f.path === selected.path);
    if (existing) ws.updateContent(selected.path, selected.content);
    else ws.openFile({ path: selected.path, name, content: selected.content, saved: "" });
    ws.setActive(selected.path);
    setMsg(`Restored snapshot into editor buffer (unsaved): ${name}`);
  }
  async function copyContent() { if (selected) { try { await navigator.clipboard.writeText(selected.content); setMsg("Copied snapshot content."); } catch {} } }
  async function del(id?: number) { await tmApi.delete(id ? { id } : { path: selected?.path }).catch((e) => setMsg(String(e))); if (selected?.id === id) setSelected(null); void load(); }

  const grouped = useMemo(() => {
    const map = new Map<string, SnapshotMeta[]>();
    for (const i of items) { const k = i.path; const a = map.get(k) || []; a.push(i); map.set(k, a); }
    return [...map.entries()];
  }, [items]);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 12 }}>Workspace Time Machine</strong>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Local save/draft snapshots (no cloud)</span>
          <button className="btn" type="button" onClick={() => void load()} disabled={busy}>{busy ? "Loading…" : "Refresh"}</button>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}><input type="checkbox" checked={scopeActive} onChange={(e) => setScopeActive(e.target.checked)} /> Active file only</label>
          {selected ? <button className="btn" type="button" onClick={() => void del(selected.id)}>Delete Snapshot</button> : null}
        </div>
        {msg ? <div style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "pre-wrap" }}>{msg}</div> : null}
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr" }}>
        <div style={{ overflow: "auto", borderRight: "1px solid var(--border-subtle)" }}>
          {grouped.length ? grouped.map(([path, snaps]) => (
            <div key={path}>
              <div className="section-label" title={path}>{path.split(/[/\\]/).filter(Boolean).slice(-2).join("/")}</div>
              {snaps.map((s) => (
                <button key={s.id} type="button" className="tree-row" style={{ cursor: "pointer", width: "100%", background: selected?.id === s.id ? "var(--bg-2)" : "transparent", border: 0 }} onClick={() => void openSnapshot(s)}>
                  <span className="tree-glyph ts">{s.kind === "save" ? "S" : s.kind === "before-save" ? "B" : "D"}</span>
                  <span className="tree-name" style={{ fontSize: 11 }}>{fmt(s.ts)}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-faint)" }}>{Math.round(s.bytes / 102.4) / 10} KB</span>
                </button>
              ))}
            </div>
          )) : <div className="panel-body">No snapshots yet. Save files to record history; ORBIT can also capture draft snapshots for recovery.</div>}
        </div>
        <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr" }}>
          <div style={{ display: "flex", gap: 8, padding: 8, borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
            <button className="btn primary" type="button" disabled={!selected} onClick={() => void restoreToEditor()}>Restore to Editor (unsaved)</button>
            <button className="btn" type="button" disabled={!selected} onClick={() => void copyContent()}>Copy</button>
            {selected ? <span style={{ fontSize: 11, color: "var(--text-faint)", alignSelf: "center" }}>{selected.kind} · {fmt(selected.ts)} · {selected.path}</span> : null}
          </div>
          <pre className="panel-body" style={{ margin: 0, minHeight: 0 }}>{selected?.content ?? "Select a snapshot to preview. Restoring loads content into an editor buffer; save explicitly to write it to disk."}</pre>
        </div>
      </div>
    </div>
  );
}
