import { useEffect, useState } from "react";
import { orbit, type GitStatus } from "../services/orbit";

export default function GitPanel({ root, onChanged }: { root: string | null; onChanged: () => void }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [msg, setMsg] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [branchTo, setBranchTo] = useState("");

  async function refresh() {
    if (!root) return setStatus(null);
    try { const s = await orbit.gitStatus(root); setStatus(s); if (s.branch) setBranchTo(s.branch); } catch (e) { setOut(String(e)); }
  }
  useEffect(() => { void refresh(); }, [root]);

  async function run(args: string[], clearMsg = false) {
    if (!root) return;
    setBusy(true);
    try {
      const text = await orbit.gitRun(root, args);
      setOut([`$ git ${args.join(" ")}`, text || "(ok)"].filter(Boolean).join("\n"));
      if (clearMsg) setMsg("");
      await refresh(); onChanged();
    } catch (e) { setOut(`$ git ${args.join(" ")}\n${String(e)}`); }
    finally { setBusy(false); }
  }
  async function switchBranch() {
    if (!branchTo || !root) return;
    const cur = status?.branch;
    if (branchTo === cur) return;
    const exists = status?.branches?.includes(branchTo);
    await run(exists ? ["switch", branchTo] : ["switch", "-c", branchTo]);
  }

  if (!root) return <div className="panel-body">Open a workspace to use Git.</div>;
  if (status && !status.is_repo) return <div className="panel-body">No Git repository in <code>{root}</code>. Run <code>git init</code> from Terminal if needed.</div>;

  const staged = status?.changed.filter((c) => c.staged) ?? [];
  const unstaged = status?.changed.filter((c) => !c.staged) ?? [];
  const ab = status ? ` ↑${status.ahead || 0} ↓${status.behind || 0}` : "";

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="status-item pill" title={status?.upstream || ""}>⎇ {status?.branch || "(detached)"}{ab}</span>
          <input list="orbit-git-branches" value={branchTo} onChange={(e) => setBranchTo(e.target.value)} placeholder="branch (existing or new)" style={{ width: 180, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
          <datalist id="orbit-git-branches">{(status?.branches || []).map((b) => <option key={b} value={b} />)}</datalist>
          <button className="btn" type="button" disabled={busy || !branchTo} onClick={() => void switchBranch()}>Switch/Create</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["fetch", "--all", "--prune"])}>Fetch</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["pull", "--ff-only"])}>Pull</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["push"])}>Push</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Commit message" style={{ flex: 1, minWidth: 220, background: "var(--bg-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "7px 10px" }} />
          <button className="btn primary" type="button" disabled={busy || !msg.trim() || !staged.length} title={!staged.length ? "Stage files before committing" : ""} onClick={() => void run(["commit", "-m", msg.trim()], true)}>Commit</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["stash", "push", "-u", "-m", msg.trim() || "ORBIT stash"])}>Stash</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(["stash", "pop"])}>Stash Pop</button>
        </div>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr" }}>
        <div style={{ borderRight: "1px solid var(--border-subtle)", overflow: "auto", padding: 8 }}>
          <div className="section-label">STAGED ({staged.length})</div>
          {staged.length ? staged.map((c) => (
            <div key={`s:${c.path}`} className="tree-row" style={{ cursor: "default" }}>
              <span className="tree-glyph ts">{c.status}</span><span className="tree-name" title={c.path}>{c.path}</span>
              <button className="icon-btn" type="button" title="Unstage" disabled={busy} onClick={() => void run(["restore", "--staged", "--", c.path])}>−</button>
              <button className="icon-btn" type="button" title="Staged diff" disabled={busy} onClick={() => void run(["diff", "--cached", "--", c.path])}>Δ</button>
            </div>
          )) : <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "0 8px" }}>No staged changes.</div>}
          <div className="section-label">CHANGES ({unstaged.length})</div>
          {unstaged.length ? unstaged.map((c) => (
            <div key={`u:${c.path}`} className="tree-row" style={{ cursor: "default" }}>
              <span className="tree-glyph rs">{c.status}</span><span className="tree-name" title={c.path}>{c.path}</span>
              <button className="icon-btn" type="button" title="Stage" disabled={busy} onClick={() => void run(["add", "--", c.path])}>+</button>
              <button className="icon-btn" type="button" title="Diff" disabled={busy} onClick={() => void run(["diff", "--", c.path])}>Δ</button>
              {c.status !== "?" ? <button className="icon-btn" type="button" title="Discard tracked changes (cannot undo)" disabled={busy} onClick={() => window.confirm(`Discard tracked changes in ${c.path}?`) && void run(["restore", "--", c.path])}>↺</button> : null}
            </div>
          )) : <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "0 8px" }}>No unstaged changes.</div>}
          <div className="section-label">STASHES</div>
          {(status?.stashes?.length ? status.stashes : ["No stashes"]).slice(0, 8).map((s, i) => <div key={i} style={{ fontSize: 11, color: "var(--text-faint)", padding: "2px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s}>{s}</div>)}
          <div style={{ display: "flex", gap: 8, padding: "10px 4px 4px", flexWrap: "wrap" }}>
            <button className="btn" type="button" disabled={busy || !unstaged.length} onClick={() => void run(["add", "-A"])}>Stage All</button>
            <button className="btn" type="button" disabled={busy} onClick={() => void run(["log", "--oneline", "-n", "25", "--decorate", "--graph"])}>History</button>
          </div>
        </div>
        <pre className="panel-body" style={{ margin: 0, border: 0, minHeight: 0 }}>{out || "Git output appears here. Diff/history/stash/discard use the local git CLI. Push/pull may require configured credentials/remote."}</pre>
      </div>
    </div>
  );
}
