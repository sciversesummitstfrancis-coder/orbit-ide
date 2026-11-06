import { useEffect, useState } from "react";
import { capsulesApi, type Capsule, type CapsuleMeta } from "../services/capsules";
import { orbit } from "../services/orbit";
import { useWorkspace } from "../store/workspace";

function fmt(ts: number) { try { return new Date(ts).toLocaleString(); } catch { return String(ts); } }

export default function CapsulesPanel() {
  const ws = useWorkspace();
  const [items, setItems] = useState<CapsuleMeta[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Capsule | null>(null);
  const [msg, setMsg] = useState("");
  const [scopeWs, setScopeWs] = useState(true);

  async function load() { try { setItems(await capsulesApi.list(scopeWs && ws.root ? ws.root : undefined, 120)); } catch (e) { setMsg(String(e)); } }
  useEffect(() => { void load(); }, [ws.root, scopeWs]);

  async function capture() {
    const capsuleName = name.trim() || `Capsule ${new Date().toLocaleString()}`;
    let git: any = null;
    if (ws.root) try { git = await orbit.gitStatus(ws.root); } catch {}
    const data = {
      version: 1,
      note: note.trim() || undefined,
      root: ws.root,
      activePath: ws.activePath,
      openFiles: ws.files.map((f) => ({ path: f.path, dirty: f.content !== f.saved })),
      selection: ws.selection,
      git: git ? { branch: git.branch, changed: git.changed?.length, ahead: git.ahead, behind: git.behind } : null,
      receiptsHint: "Use Receipts tab for detailed command history.",
      capturedAt: new Date().toISOString(),
    };
    try { await capsulesApi.save({ name: capsuleName, workspace: ws.root, data }); setName(""); setNote(""); setMsg(`Saved "${capsuleName}".`); void load(); } catch (e) { setMsg(String(e)); }
  }
  async function openMeta(m: CapsuleMeta) { try { setSelected(await capsulesApi.get(m.id)); } catch (e) { setMsg(String(e)); } }
  async function restoreCapsule() {
    if (!selected) return;
    const d = selected.data || {};
    try {
      if (d.root && d.root !== ws.root) { setMsg(`Capsule workspace is ${d.root}. Open that folder first to restore files safely.`); }
      for (const f of d.openFiles || []) {
        if (!f?.path) continue;
        try { const content = await orbit.readFile(f.path); const fname = String(f.path).split(/[/\\]/).filter(Boolean).pop() || String(f.path); ws.openFile({ path: f.path, name: fname, content, saved: content }); } catch {}
      }
      if (d.activePath) ws.setActive(d.activePath);
      setMsg(`Restored capsule context: ${selected.name}. Dirty unsaved edits are not stored in capsules; use Time Machine for draft recovery.`);
    } catch (e) { setMsg(String(e)); }
  }
  async function del(id: string) { if (!window.confirm("Delete this capsule?")) return; await capsulesApi.delete(id).catch((e) => setMsg(String(e))); if (selected?.id === id) setSelected(null); void load(); }
  async function copy() { if (selected) try { await navigator.clipboard.writeText(JSON.stringify(selected, null, 2)); setMsg("Copied capsule JSON."); } catch {} }

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 12 }}>Task Capsules</strong>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Local context bundles: files, git, selection, notes</span>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, marginLeft: "auto" }}><input type="checkbox" checked={scopeWs} onChange={(e) => setScopeWs(e.target.checked)} /> This workspace</label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Capsule name (bug, feature, review…)" style={{ flex: 1, minWidth: 180, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={{ flex: 2, minWidth: 220, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
          <button className="btn primary" type="button" onClick={() => void capture()}>Capture Capsule</button>
        </div>
        {msg ? <div style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "pre-wrap" }}>{msg}</div> : null}
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr" }}>
        <div style={{ overflow: "auto", borderRight: "1px solid var(--border-subtle)" }}>
          {items.length ? items.map((m) => (
            <button key={m.id} type="button" onClick={() => void openMeta(m)} style={{ all: "unset", display: "block", width: "100%", padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", background: selected?.id === m.id ? "var(--bg-2)" : "transparent" }}>
              <div style={{ fontSize: 12 }}>{m.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{fmt(m.updated_at)}</div>
            </button>
          )) : <div className="panel-body">No capsules yet. Capture a capsule to save local task context (open files, git summary, selection, note).</div>}
        </div>
        <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, padding: 8, borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
            <button className="btn primary" type="button" disabled={!selected} onClick={() => void restoreCapsule()}>Restore Context</button>
            <button className="btn" type="button" disabled={!selected} onClick={() => void copy()}>Copy JSON</button>
            <button className="btn" type="button" disabled={!selected} onClick={() => selected && void del(selected.id)}>Delete</button>
          </div>
          <pre className="panel-body" style={{ margin: 0 }}>{selected ? JSON.stringify(selected, null, 2) : "Select a capsule to inspect/restore. Capsules store metadata/context (not unsaved edits or secrets). Use Time Machine for draft recovery."}</pre>
        </div>
      </div>
    </div>
  );
}
