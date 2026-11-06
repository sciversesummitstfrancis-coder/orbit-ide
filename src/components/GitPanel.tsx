import { useEffect, useState } from "react";
import { orbit, type GitStatus } from "../services/orbit";

export default function GitPanel({ root, onChanged }: { root: string | null; onChanged: () => void }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [msg, setMsg] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!root) return setStatus(null);
    try { setStatus(await orbit.gitStatus(root)); } catch (e) { setOut(String(e)); }
  }
  useEffect(() => { void refresh(); }, [root]);

  async function run(args: string[], clearMsg = false) {
    if (!root) return;
    setBusy(true);
    try {
      const text = await orbit.gitRun(root, args);
      setOut([`$ git ${args.join(" ")}`, text].filter(Boolean).join("\n"));
      if (clearMsg) setMsg("");
      await refresh(); onChanged();
    } catch (e) { setOut(`$ git ${args.join(" ")}\n${String(e)}`); }
    finally { setBusy(false); }
  }

  if (!root) return <div className="panel-body">Open a workspace to use Git.</div>;
  if (status && !status.is_repo) return <div className="panel-body">No Git repository in <code>{root}</code>. Run <code>git init</code> from Terminal if needed.</div>;

  const staged = status?.changed.filter((c) => c.staged) ?? [];
  const unstaged = status?.changed.filter((c) => !c.staged) ?? [];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="status-item pill">⎇ {status?.branch || "(detached)"}</span>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["status", "--short", "--branch"])}>Status</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["fetch", "--all", "--prune"])}>Fetch</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["pull", "--ff-only"])}>Pull</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["push"])}>Push</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Commit message" style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "7px 10px" }} />
          <button className="btn primary" type="button" disabled={busy || !msg.trim() || !staged.length} title={!staged.length ? "Stage files before committing" : ""} onClick={() => void run(["commit", "-m", msg.trim()], true)}>Commit</button>
        </div>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr" }}>
        <div style={{ borderRight: "1px solid var(--border-subtle)", overflow: "auto", padding: 8 }}>
          <div className="section-label">STAGED ({staged.length})</div>
          {staged.length ? staged.map((c) => (
            <div key={`s:${c.path}`} className="tree-row" style={{ cursor: "default" }}>
              <span className="tree-glyph ts">{c.status}</span><span className="tree-name" title={c.path}>{c.path}</span>
              <button className="icon-btn" type="button" title="Unstage" disabled={busy} onClick={() => void run(["restore", "--staged", "--", c.path])}>−</button>
            </div>
          )) : <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "0 8px" }}>No staged changes.</div>}
          <div className="section-label">CHANGES ({unstaged.length})</div>
          {unstaged.length ? unstaged.map((c) => (
            <div key={`u:${c.path}`} className="tree-row" style={{ cursor: "default" }}>
              <span className="tree-glyph rs">{c.status}</span><span className="tree-name" title={c.path}>{c.path}</span>
              <button className="icon-btn" type="button" title="Stage" disabled={busy} onClick={() => void run(c.status === "?" ? ["add", "--", c.path] : ["add", "--", c.path])}>+</button>
              <button className="icon-btn" type="button" title="Diff" disabled={busy} onClick={() => void run(["diff", "--", c.path])}>Δ</button>
            </div>
          )) : <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "0 8px" }}>No unstaged changes.</div>}
          <div style={{ display: "flex", gap: 8, padding: "10px 4px 4px" }}>
            <button className="btn" type="button" disabled={busy || !unstaged.length} onClick={() => void run(["add", "-A"])}>Stage All</button>
            <button className="btn" type="button" disabled={busy} onClick={() => void run(["log", "--oneline", "-n", "20", "--decorate"])}>History</button>
          </div>
        </div>
        <pre className="panel-body" style={{ margin: 0, border: 0, minHeight: 0 }}>{out || "Git output appears here. Use Diff, Status, History, Fetch, Pull, and Push. Push/pull may require configured credentials/remote."}</pre>
      </div>
    </div>
  );
}
