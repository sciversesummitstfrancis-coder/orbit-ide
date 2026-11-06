import { useEffect, useMemo, useState } from "react";
import { receiptsApi, type Receipt } from "../services/receipts";
import { orbit } from "../services/orbit";
import { useWorkspace } from "../store/workspace";

const CATS = ["all", "git", "file", "terminal", "ai", "lsp", "system"] as const;
function fmtTs(ts: number) { try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return String(ts); } }
function statusColor(s: string) { return s === "ok" ? "var(--success, #22c55e)" : s === "warn" ? "var(--warning, #eab308)" : "var(--danger)"; }

export default function ReceiptsPanel() {
  const ws = useWorkspace();
  const [items, setItems] = useState<Receipt[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [scopeWs, setScopeWs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setBusy(true);
    try {
      const rows = await receiptsApi.list({ limit: 300, category: cat === "all" ? undefined : cat, search: q || undefined, workspace: scopeWs && ws.root ? ws.root : undefined });
      setItems(rows);
      if (selected && !rows.find((r) => r.id === selected.id)) setSelected(null);
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); const t = window.setInterval(load, 4000); return () => window.clearInterval(t); }, [cat, q, scopeWs, ws.root]);

  async function replay(r: Receipt) {
    const d = (r.detail && typeof r.detail === "object" ? r.detail : {}) as Record<string, any>;
    try {
      if (r.category === "git" && Array.isArray(d.args) && ws.root) {
        if (!window.confirm(`Re-run in workspace?\n\ngit ${d.args.join(" ")}`)) return;
        const out = await orbit.gitRun(ws.root, d.args.map(String));
        setMsg(`$ git ${d.args.join(" ")}\n${out || "(ok)"}`);
      } else if (d.path) {
        const name = String(d.path).split(/[/\\]/).filter(Boolean).pop() || String(d.path);
        const content = await orbit.readFile(String(d.path));
        ws.openFile({ path: String(d.path), name, content, saved: content });
        setMsg(`Opened ${d.path}`);
      } else {
        await navigator.clipboard.writeText(JSON.stringify({ summary: r.summary, detail: r.detail }, null, 2));
        setMsg("Copied receipt details to clipboard.");
      }
    } catch (e) { setMsg(String(e)); }
  }
  async function copy(r: Receipt) { try { await navigator.clipboard.writeText(JSON.stringify(r, null, 2)); setMsg("Copied receipt."); } catch {} }

  const counts = useMemo(() => {
    const m = new Map<string, number>(); for (const r of items) m.set(r.category, (m.get(r.category) || 0) + 1); return m;
  }, [items]);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 12 }}>Command Receipts</strong>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Local SQLite audit trail (no cloud)</span>
          <button className="btn" type="button" disabled={busy} onClick={() => void load()}>{busy ? "Loading…" : "Refresh"}</button>
          <button className="btn" type="button" onClick={async () => { if (!window.confirm("Clear all local command receipts?")) return; await receiptsApi.clear().catch(() => {}); setSelected(null); void load(); }}>Clear</button>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, marginLeft: "auto" }}><input type="checkbox" checked={scopeWs} onChange={(e) => setScopeWs(e.target.checked)} /> This workspace</label>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATS.map((c) => <button key={c} type="button" className={`btn ${cat === c ? "primary" : ""}`} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setCat(c)}>{c}{c !== "all" && counts.get(c) ? ` (${counts.get(c)})` : ""}</button>)}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search summary/action/detail…" style={{ flex: 1, minWidth: 180, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
        </div>
        {msg ? <div style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "pre-wrap" }}>{msg}</div> : null}
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(280px, 420px)" }}>
        <div style={{ overflow: "auto", borderRight: "1px solid var(--border-subtle)" }}>
          {items.length ? items.map((r) => (
            <button key={r.id} type="button" onClick={() => setSelected(r)} style={{ all: "unset", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, width: "100%", padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", background: selected?.id === r.id ? "var(--bg-2)" : "transparent" }}>
              <span style={{ fontSize: 10, color: statusColor(r.status), fontWeight: 700, textTransform: "uppercase" }}>{r.status}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.summary}</span>
                <span style={{ display: "block", fontSize: 10, color: "var(--text-faint)" }}>{r.category}/{r.action}{r.duration_ms != null ? ` · ${r.duration_ms}ms` : ""}</span>
              </span>
              <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{fmtTs(r.ts)}</span>
            </button>
          )) : <div className="panel-body">No receipts yet. Save a file, run a git action, open/close a terminal, or run local AI to build a local timeline.</div>}
        </div>
        <div style={{ overflow: "auto", padding: 10 }}>
          {selected ? <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <button className="btn primary" type="button" onClick={() => void replay(selected)}>Open / Replay</button>
              <button className="btn" type="button" onClick={() => void copy(selected)}>Copy</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>{selected.category}/{selected.action} · {new Date(selected.ts).toLocaleString()} · {selected.status}{selected.workspace ? ` · ${selected.workspace}` : ""}</div>
            <pre className="panel-body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(selected, null, 2)}</pre>
          </ : <div className="panel-body">Select a receipt to inspect details. “Open / Replay” opens file paths, re-runs git commands with confirmation in the current workspace, or copies details.</div>}
        </div>
      </div>
    </div>
  );
}
