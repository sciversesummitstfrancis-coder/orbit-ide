import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/tokens.css";
import "./styles/app.css";
import Explorer from "./components/Explorer";
import OrbitEditor from "./components/Editor";
import TerminalPanel from "./components/TerminalPanel";
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
  const workspaceName = ws.root ? ws.root.split(/[/\\]/).filter(Boolean).pop() || ws.root : "No workspace";
  const dirty = !!active && active.content !== active.saved;

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
      setActivity("explorer");
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o" && !e.shiftKey) { e.preventDefault(); void openFolder(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, ws.root]);

  return (
    <div className="orbit-app">
      <header className="header">
        <div className="brand" aria-label="ORBIT IDE">
          <span className="brand-mark" />
          <span className="brand-name">ORBIT</span>
          <span className="brand-sub" title={ws.root || undefined}>{workspaceName}</span>
        </div>
        <button className="command" type="button" aria-label="Command search">
          <span>Search commands and files…</span><span className="command-kbd">Ctrl+P</span>
        </button>
        <button className="icon-btn" type="button" title="Open Folder (Ctrl+O)" onClick={() => void openFolder()}>▤</button>
        <button className="icon-btn" type="button" title="Save (Ctrl+S)" onClick={() => void saveActive()} disabled={!dirty}>●</button>
        <button className="icon-btn" type="button" title="Settings" onClick={() => setActivity("settings")}>⚙</button>
      </header>

      <div className="main">
        <nav className="activity" aria-label="Activity bar">
          {activities.map((a) => (
            <button key={a.id} type="button" className={`icon-btn ${activity === a.id ? "active" : ""}`} title={a.label} aria-label={a.label} aria-pressed={activity === a.id} onClick={() => setActivity(a.id)}>{a.glyph}</button>
          ))}
        </nav>

        <aside className="sidebar">
          <div className="sidebar-header">
            <span>{activities.find((a) => a.id === activity)?.label.toUpperCase()}</span>
            {activity === "explorer" && ws.root ? <button className="icon-btn" type="button" title="Refresh explorer and Git" onClick={() => void refreshExplorer()}>↻</button> : null}
          </div>
          <div className="sidebar-body">
            {activity === "explorer" ? <Explorer onOpenFolder={openFolder} /> :
             activity === "git" ? <div style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{ws.git?.is_repo ? `Branch: ${ws.git.branch || "(detached)"}\nChanged: ${ws.git.changed.length}\n\n${ws.git.changed.map((c) => `${c.staged ? "S" : " "} ${c.status} ${c.path}`).join("\n") || "Working tree clean."}` : "No Git repository detected in this workspace."}</div> :
             activity === "search" ? <div className="empty-state"><p>Workspace search is planned for Milestone 8.</p><p style={{ fontSize: 12 }}>Use file open and Git status for now.</p></div> :
             <div className="empty-state"><p>{activities.find((a) => a.id === activity)?.label} is planned for a later milestone.</p></div>}
            {error ? <div style={{ marginTop: 10, color: "var(--danger)", whiteSpace: "pre-wrap", fontSize: 12 }}>{error}</div> : null}
          </div>
        </aside>

        <section className="workbench">
          <div className="editor-area">
            <div className="tabs" role="tablist" aria-label="Open editors">
              {ws.files.length ? ws.files.map((f) => {
                const isDirty = f.content !== f.saved;
                return (
                  <button key={f.path} className={`tab ${ws.activePath === f.path ? "active" : ""}`} type="button" onClick={() => ws.setActive(f.path)} title={f.path}>
                    <span className="tab-label">{f.name}</span>
                    {isDirty ? <span className="tab-dirty" aria-label="Unsaved changes">•</span> : null}
                    <span className="tab-close" role="button" aria-label={`Close ${f.name}`} onClick={(e) => { e.stopPropagation(); ws.closeFile(f.path); }}>×</span>
                  </button>
                );
              }) : <button className="tab active" type="button">Welcome</button>}
            </div>
            <div className="editor-surface">
              {active ? (
                <OrbitEditor path={active.path} value={active.content} onChange={(v) => ws.updateContent(active.path, v)} onSave={() => void saveActive()} />
              ) : (
                <div className="welcome">
                  <div className="welcome-card">
                    <div className="welcome-orbit" aria-hidden="true" />
                    <h1>ORBIT IDE</h1>
                    <p className="tagline">Your code. Your environment. Your orbit.</p>
                    <p>Open a local folder, browse files, edit in Monaco, and save through native Rust services.</p>
                    <div className="actions">
                      <button className="btn primary" type="button" onClick={openFolder}>Open Folder</button>
                      <button className="btn" type="button" disabled title="Planned">Recent Workspaces</button>
                    </div>
                    <div className="hint">Shortcuts: <code>Ctrl/Cmd+O</code> open folder · <code>Ctrl/Cmd+S</code> save</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bottom">
            <div className="panel-tabs" role="tablist" aria-label="Panel tabs">
              {(["terminal", "problems", "output", "debug", "git-history"] as PanelTab[]).map((t) => (
                <button key={t} type="button" className={`panel-tab ${panel === t ? "active" : ""}`} onClick={() => setPanel(t)}>{{ terminal: "Terminal", problems: "Problems", output: "Output", debug: "Debug Console", "git-history": "Git History" }[t]}</button>
              ))}
            </div>
            {panel === "terminal" ? (
              <div style={{ minHeight: 0, height: "100%" }}><TerminalPanel cwd={ws.root} /></div>
            ) : (
              <div className="panel-body">
                {panel === "git-history" ? (ws.root ? "Git history view is planned for Milestone 6. The Source Control sidebar shows current branch and changed files." : "Open a workspace to inspect Git history.") :
                 panel === "output" ? (error ? `Last error:\n${error}` : "Output channel ready.") :
                 panel === "problems" ? "Diagnostics and LSP problems are planned for Milestone 7." :
                 "Debug console is planned for a later milestone."}
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="status">
        <div className="left">
          <span className="status-item pill">⎇ {ws.git?.is_repo ? (ws.git.branch || "detached") : "no git"}</span>
          <span className="status-item" title={ws.root || ""}>{workspaceName}</span>
          {dirty ? <span className="status-item pill warn">Unsaved</span> : null}
        </div>
        <div className="right">
          <span className="status-item">UTF-8</span>
          <span className="status-item">Spaces: 2</span>
          <span className="status-item">{active ? active.name.split(".").pop()?.toUpperCase() || "TEXT" : "PLAIN TEXT"}</span>
        </div>
      </footer>
    </div>
  );
}
