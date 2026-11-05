import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/tokens.css";
import "./styles/app.css";
import Explorer from "./components/Explorer";
import OrbitEditor from "./components/Editor";
import { orbit } from "./services/orbit";
import { useWorkspace } from "./store/workspace";

type Activity = "explorer" | "search" | "git" | "extensions" | "debug" | "settings";
type PanelTab = "terminal" | "problems" | "output" | "debug" | "git-history";
const activities: { id: Activity; label: string; glyph: string }[] = [
  { id: "explorer", label: "Explorer", glyph: "▤" },
  { id: "search", label: "Search", glyph: "⌕" },
  { id: "git", label: "Source Control", glyph: "⎇" },
  { id: "extensions", label: "Extensions", glyph: "▣" },
  { id: "debug", label: "Debug", glyph: "◌" },
  { id: "settings", label: "Settings", glyph: "⚙" },
];

export default function App() {
  const [activity, setActivity] = useState<Activity>("explorer");
  const [panel, setPanel] = useState<PanelTab>("terminal");
  const [error, setError] = useState<string | null>(null);
  const ws = useWorkspace();
  const active = useMemo(() => ws.files.find((f) => f.path === ws.activePath) ?? null, [ws.files, ws.activePath]);
  const workspaceName = ws.root ? ws.root.split(/[/\\]/).filter(Boolean).pop() : "No workspace";

  async function refreshGit() {
    if (!ws.root) return ws.setGit(null);
    ws.setGit(await orbit.gitStatus(ws.root).catch(() => null));
  }
  async function openFolder() {
    try {
      setError(null);
      const selected = await open({ directory: true, multiple: false, title: "Open Folder" });
      if (!selected || Array.isArray(selected)) return;
      ws.setRoot(selected);
      ws.setEntries(await orbit.listDir(selected));
      ws.setGit(await orbit.gitStatus(selected).catch(() => null));
    } catch (e) { setError(String(e)); }
  }
  async function saveActive() {
    if (!active) return;
    try { setError(null); await orbit.writeFile(active.path, active.content); ws.markSaved(active.path); await refreshGit(); }
    catch (e) { setError(`Save failed: ${String(e)}`); }
  }
  async function refreshExplorer() {
    if (!ws.root) return;
    try { ws.setEntries(await orbit.listDir(ws.root)); await refreshGit(); } catch (e) { setError(String(e)); }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void saveActive(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <div className="orbit-app">
      <header className="header">
        <div className="brand" aria-label="ORBIT IDE"><span className="brand-mark" /><span>ORBIT</span><span className="brand-sub">{workspaceName}</span></div>
        <button className="command" type="button">Search commands and files…</button>
        <button className="icon-btn" type="button" title="Save" onClick={() => void saveActive()} disabled={!active || active.content === active.saved}>💾</button>
        <button className="icon-btn" type="button" title="Settings" onClick={() => setActivity("settings")}>⚙</button>
      </header>
      <div className="main">
        <nav className="activity" aria-label="Activity bar">
          {activities.map((a) => (
            <button key={a.id} type="button" className={`icon-btn ${activity === a.id ? "active" : ""}`} title={a.label} aria-label={a.label} aria-pressed={activity === a.id} onClick={() => setActivity(a.id)}>{a.glyph}</button>
          ))}
        </nav>
        <aside className="sidebar">
          <div className="sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{activities.find((a) => a.id === activity)?.label.toUpperCase()}</span>
            {activity === "explorer" && ws.root ? <button className="icon-btn" type="button" title="Refresh" onClick={() => void refreshExplorer()}>↻</button> : null}
          </div>
          <div className="sidebar-body">
            {activity === "explorer" ? <Explorer onOpenFolder={openFolder} /> :
             activity === "git" ? <div style={{ whiteSpace: "pre-wrap" }}>{ws.git?.is_repo ? `Branch: ${ws.git.branch || "(detached)"}\nChanged files: ${ws.git.changed.length}\n\n${ws.git.changed.map((c) => `${c.staged ? "S" : " "} ${c.status} ${c.path}`).join("\n") || "(clean)"}` : "No Git repository detected in workspace."}</div> :
             <div>{activities.find((a) => a.id === activity)?.label} planned for a later milestone.</div>}
            {error ? <div style={{ marginTop: 10, color: "var(--danger)", whiteSpace: "pre-wrap" }}>{error}</div> : null}
          </div>
        </aside>
        <section className="workbench">
          <div className="editor-area">
            <div className="tabs" role="tablist">
              {ws.files.length ? ws.files.map((f) => (
                <button key={f.path} className={`tab ${ws.activePath === f.path ? "active" : ""}`} type="button" onClick={() => ws.setActive(f.path)} title={f.path}>
                  {f.name}{f.content !== f.saved ? " •" : ""} <span className="tab-close" onClick={(e) => { e.stopPropagation(); ws.closeFile(f.path); }}>×</span>
                </button>
              )) : <button className="tab active" type="button">Welcome</button>}
            </div>
            <div className="editor-surface" style={active ? { alignItems: "stretch", justifyContent: "stretch" } : undefined}>
              {active ? (
                <OrbitEditor path={active.path} value={active.content} onChange={(v) => ws.updateContent(active.path, v)} onSave={() => void saveActive()} />
              ) : (
                <div className="welcome">
                  <h1>ORBIT IDE</h1><p>Your code. Your environment. Your orbit.</p>
                  <div className="actions">
                    <button className="btn primary" type="button" onClick={openFolder}>Open Folder</button>
                    <button className="btn" type="button" disabled title="Planned">Recent Workspaces</button>
                  </div>
                  <p style={{ marginTop: 14, fontSize: 12 }}>Open a folder, click files in Explorer, edit in Monaco, and press <code>Ctrl/Cmd+S</code> to save via the Tauri/Rust filesystem service.</p>
                </div>
              )}
            </div>
          </div>
          <div className="bottom">
            <div className="panel-tabs">
              {(["terminal", "problems", "output", "debug", "git-history"] as PanelTab[]).map((t) => (
                <button key={t} type="button" className={`panel-tab ${panel === t ? "active" : ""}`} onClick={() => setPanel(t)}>{{ terminal: "Terminal", problems: "Problems", output: "Output", debug: "Debug Console", "git-history": "Git History" }[t]}</button>
              ))}
            </div>
            <div className="panel-body" style={{ whiteSpace: "pre-wrap" }}>
              {panel === "terminal" ? "Integrated PTY terminal (Rust + xterm.js) — Milestone 5." :
               panel === "git-history" ? (ws.root ? "Git history view — Milestone 6. Use Source Control sidebar for current status." : "Open a workspace to inspect Git history.") :
               panel === "output" ? (error ? `Last error:\n${error}` : "Output channel ready.") :
               `${panel} panel — planned.`}
            </div>
          </div>
        </section>
      </div>
      <footer className="status">
        <div className="left"><span className="pill">⎇ {ws.git?.is_repo ? (ws.git.branch || "detached") : "no git"}</span><span title={ws.root || ""}>{ws.root ? workspaceName : "Workspace: none"}</span>{active && active.content !== active.saved ? <span>Unsaved</span> : null}</div>
        <div className="right"><span>UTF-8</span><span>Spaces: 2</span><span>{active ? "Editor" : "Ln 1, Col 1"}</span><span>{active ? active.name.split(".").pop() || "Text" : "Plain Text"}</span></div>
      </footer>
    </div>
  );
}
