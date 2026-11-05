import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/tokens.css";
import "./styles/app.css";
import Explorer from "./components/Explorer";
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
  const { root, entries, git, files, activePath, setRoot, setEntries, setGit, setActive, closeFile } = useWorkspace();
  const active = useMemo(() => files.find((f) => f.path === activePath) ?? null, [files, activePath]);
  const workspaceName = root ? root.split(/[/\\]/).filter(Boolean).pop() : "No workspace";

  async function openFolder() {
    try {
      setError(null);
      const selected = await open({ directory: true, multiple: false, title: "Open Folder" });
      if (!selected || Array.isArray(selected)) return;
      setRoot(selected);
      setEntries(await orbit.listDir(selected));
      setGit(await orbit.gitStatus(selected).catch(() => null));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="orbit-app">
      <header className="header">
        <div className="brand" aria-label="ORBIT IDE">
          <span className="brand-mark" /><span>ORBIT</span>
          <span className="brand-sub">{workspaceName}</span>
        </div>
        <button className="command" type="button" aria-label="Command search">Search commands and files…</button>
        <button className="icon-btn" type="button" title="Settings" onClick={() => setActivity("settings")}>⚙</button>
      </header>

      <div className="main">
        <nav className="activity" aria-label="Activity bar">
          {activities.map((a) => (
            <button key={a.id} type="button" className={`icon-btn ${activity === a.id ? "active" : ""}`} title={a.label} aria-label={a.label} aria-pressed={activity === a.id} onClick={() => setActivity(a.id)}>{a.glyph}</button>
          ))}
        </nav>

        <aside className="sidebar" aria-label="Side panel">
          <div className="sidebar-header">{activities.find((a) => a.id === activity)?.label.toUpperCase()}</div>
          <div className="sidebar-body">
            {activity === "explorer" ? <Explorer onOpenFolder={openFolder} /> :
             activity === "git" ? <div>{git?.is_repo ? `Branch: ${git.branch || "(detached)"}\nChanged: ${git.changed.length}` : "No Git repository detected in workspace."}</div> :
             <div>{activities.find((a) => a.id === activity)?.label} will be implemented in its milestone.</div>}
            {error ? <div style={{ marginTop: 10, color: "var(--danger)", whiteSpace: "pre-wrap" }}>{error}</div> : null}
          </div>
        </aside>

        <section className="workbench" aria-label="Workbench">
          <div className="editor-area">
            <div className="tabs" role="tablist" aria-label="Open editors">
              {files.length ? files.map((f) => (
                <button key={f.path} className={`tab ${activePath === f.path ? "active" : ""}`} type="button" role="tab" aria-selected={activePath === f.path} onClick={() => setActive(f.path)} title={f.path}>
                  {f.name}{f.content !== f.saved ? " •" : ""} <span className="tab-close" onClick={(e) => { e.stopPropagation(); closeFile(f.path); }}>×</span>
                </button>
              )) : <button className="tab active" type="button" role="tab" aria-selected="true">Welcome</button>}
            </div>
            <div className="editor-surface" style={active ? { alignItems: "stretch", justifyContent: "stretch" } : undefined}>
              {active ? (
                <pre style={{ margin: 0, padding: 14, overflow: "auto", width: "100%", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 }}>{active.content}</pre>
              ) : (
                <div className="welcome">
                  <h1>ORBIT IDE</h1><p>Your code. Your environment. Your orbit.</p>
                  <div className="actions">
                    <button className="btn primary" type="button" onClick={openFolder}>Open Folder</button>
                    <button className="btn" type="button" disabled title="Milestone 4">New File</button>
                    <button className="btn" type="button" disabled title="Milestone 8">Recent Workspaces</button>
                  </div>
                  <p style={{ marginTop: 14, fontSize: 12 }}>Milestone 3 baseline: Tauri dialog + Rust filesystem commands power the explorer. Monaco editing, save/recovery, PTY terminal, Git UI, LSP, and SQLite persistence follow in later milestones.</p>
                </div>
              )}
            </div>
          </div>
          <div className="bottom" aria-label="Bottom panel">
            <div className="panel-tabs" role="tablist" aria-label="Panel tabs">
              {(["terminal", "problems", "output", "debug", "git-history"] as PanelTab[]).map((t) => (
                <button key={t} type="button" className={`panel-tab ${panel === t ? "active" : ""}`} onClick={() => setPanel(t)}>{{ terminal: "Terminal", problems: "Problems", output: "Output", debug: "Debug Console", "git-history": "Git History" }[t]}</button>
              ))}
            </div>
            <div className="panel-body">{panel === "terminal" ? "Integrated PTY terminal: Milestone 5." : `${panel} panel scaffold.`}</div>
          </div>
        </section>
      </div>

      <footer className="status" aria-label="Status bar">
        <div className="left"><span className="pill">⎇ {git?.is_repo ? (git.branch || "detached") : "no git"}</span><span title={root || ""}>{root ? workspaceName : "Workspace: none"}</span>{error ? <span style={{ color: "var(--danger)" }}>Error</span> : null}</div>
        <div className="right"><span>UTF-8</span><span>Spaces: 2</span><span>Ln 1, Col 1</span><span>{active ? (active.name.split(".").pop() || "Text") : "Plain Text"}</span><span>{entries.length ? `${entries.length} items` : ""}</span></div>
      </footer>
    </div>
  );
}
