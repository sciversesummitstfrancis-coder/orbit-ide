import { useState } from "react";
import "./styles/tokens.css";
import "./styles/app.css";

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

  return (
    <div className="orbit-app">
      <header className="header">
        <div className="brand" aria-label="ORBIT IDE">
          <span className="brand-mark" />
          <span>ORBIT</span>
          <span className="brand-sub">No workspace</span>
        </div>
        <button className="command" type="button" aria-label="Command search">
          Search commands and files…
        </button>
        <button className="icon-btn" type="button" title="Settings" onClick={() => setActivity("settings")}>⚙</button>
      </header>

      <div className="main">
        <nav className="activity" aria-label="Activity bar">
          {activities.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`icon-btn ${activity === a.id ? "active" : ""}`}
              title={a.label}
              aria-label={a.label}
              aria-pressed={activity === a.id}
              onClick={() => setActivity(a.id)}
            >
              {a.glyph}
            </button>
          ))}
        </nav>

        <aside className="sidebar" aria-label="Side panel">
          <div className="sidebar-header">{activities.find((a) => a.id === activity)?.label.toUpperCase()}</div>
          <div className="sidebar-body">
            {activity === "explorer" ? (
              <div>
                <div>No folder open.</div>
                <div style={{ marginTop: 10 }}><button className="btn primary" type="button">Open Folder</button></div>
                <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-faint)" }}>Filesystem, recent workspaces, and Git integration are added in upcoming milestones.</div>
              </div>
            ) : (
              <div>{activities.find((a) => a.id === activity)?.label} is scaffolded and will be implemented in its milestone.</div>
            )}
          </div>
        </aside>

        <section className="workbench" aria-label="Workbench">
          <div className="editor-area">
            <div className="tabs" role="tablist" aria-label="Open editors">
              <button className="tab active" type="button" role="tab" aria-selected="true">Welcome</button>
            </div>
            <div className="editor-surface">
              <div className="welcome">
                <h1>ORBIT IDE</h1>
                <p>Your code. Your environment. Your orbit.</p>
                <div className="actions">
                  <button className="btn primary" type="button">Open Folder</button>
                  <button className="btn" type="button">New File</button>
                  <button className="btn" type="button">Recent Workspaces</button>
                </div>
                <p style={{ marginTop: 14, fontSize: 12 }}>Milestone 1–2 baseline: native Tauri shell and Orbit design system. Editor, filesystem, terminal, Git, LSP, and persistence are wired incrementally.</p>
              </div>
            </div>
          </div>

          <div className="bottom" aria-label="Bottom panel">
            <div className="panel-tabs" role="tablist" aria-label="Panel tabs">
              {(["terminal", "problems", "output", "debug", "git-history"] as PanelTab[]).map((t) => (
                <button key={t} type="button" className={`panel-tab ${panel === t ? "active" : ""}`} onClick={() => setPanel(t)}>
                  {{ terminal: "Terminal", problems: "Problems", output: "Output", debug: "Debug Console", "git-history": "Git History" }[t]}
                </button>
              ))}
            </div>
            <div className="panel-body">
              {panel === "terminal" ? "Integrated PTY terminal will be implemented in Milestone 5 (Rust process management + xterm.js)." : `${panel} panel scaffold.`}
            </div>
          </div>
        </section>
      </div>

      <footer className="status" aria-label="Status bar">
        <div className="left">
          <span className="pill">⎇ no git</span>
          <span>Workspace: none</span>
        </div>
        <div className="right">
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          <span>Ln 1, Col 1</span>
          <span>Plain Text</span>
        </div>
      </footer>
    </div>
  );
}
