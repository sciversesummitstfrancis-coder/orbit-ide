import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/tokens.css";
import "./styles/app.css";
import Explorer from "./components/Explorer";
import OrbitEditor from "./components/Editor";
import TerminalPanel from "./components/TerminalPanel";
import GitPanel from "./components/GitPanel";
import LspPanel from "./components/LspPanel";
import ExtensionsAiPanel from "./components/ExtensionsAiPanel";
import ReceiptsPanel from "./components/ReceiptsPanel";
import Splash from "./components/Splash";
import { DebugIcon, ExplorerIcon, ExtensionsIcon, GitIcon, OrbitMark, RefreshIcon, SaveIcon, SearchIcon, SettingsIcon } from "./components/Icons";
import { orbit, workspaceApi, type RecentWorkspace } from "./services/orbit";
import { checkForUpdate, getUpdaterConfig, setUpdaterConfig } from "./services/updater";
import { useWorkspace } from "./store/workspace";

type Activity = "explorer" | "search" | "git" | "extensions" | "debug" | "settings";
type PanelTab = "terminal" | "problems" | "output" | "debug" | "git-history" | "receipts";
const activities: { id: Activity; label: string; icon: (p: { width?: number; height?: number }) => ReactElement }[] = [
  { id: "explorer", label: "Explorer", icon: ExplorerIcon },
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "git", label: "Source Control", icon: GitIcon },
  { id: "extensions", label: "Extensions", icon: ExtensionsIcon },
  { id: "debug", label: "Debug", icon: DebugIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activity, setActivity] = useState<Activity>("explorer");
  const [panel, setPanel] = useState<PanelTab>("terminal");
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelH, setPanelH] = useState(240);
  const [dragY, setDragY] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [autoUpdate, setAutoUpdate] = useState(false);
  const ws = useWorkspace();
  useEffect(() => { getUpdaterConfig().then((c) => { setAutoUpdate(c.autoCheck); if (c.autoCheck) void checkForUpdate({ auto: true }).then((r) => { if (r.status === "available") setUpdateStatus(`Update ${r.version} available`); }); }).catch(() => {}); }, []);
  const restoredRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const active = useMemo(() => ws.files.find((f) => f.path === ws.activePath) ?? null, [ws.files, ws.activePath]);
  const workspaceName = ws.root ? ws.root.split(/[/\\]/).filter(Boolean).pop() || ws.root : "No workspace";
  const dirty = !!active && active.content !== active.saved;

  async function refreshGit() {
    if (!ws.root) return ws.setGit(null);
    ws.setGit(await orbit.gitStatus(ws.root).catch(() => null));
  }
  async function loadRecent() { setRecent(await workspaceApi.listRecent().catch(() => [])); }
  async function persistSession() {
    if (!(window as any).__TAURI_INTERNALS__) return;
    await workspaceApi.saveSession({ root: ws.root, active_path: ws.activePath, open_files: ws.files.map((f) => f.path) }).catch(() => {});
  }
  function queuePersist() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void persistSession(); }, 350);
  }
  async function openWorkspacePath(path: string) {
    setError(null);
    ws.setRoot(path);
    ws.setEntries(await orbit.listDir(path));
    ws.setGit(await orbit.gitStatus(path).catch(() => null));
    await workspaceApi.addRecent(path).catch(() => {});
    await loadRecent();
    setActivity("explorer");
  }
  async function openFolder() {
    try {
      setError(null);
      const selected = await open({ directory: true, multiple: false, title: "Open Folder" });
      if (!selected || Array.isArray(selected)) return;
      await openWorkspacePath(selected);
    } catch (e) { setError(String(e)); }
  }
  async function openFileByPath(path: string, activate = false) {
    const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
    const content = await orbit.readFile(path);
    ws.openFile({ path, name, content, saved: content });
    if (activate) ws.setActive(path);
  }
  async function saveActive() {
    if (!active) return;
    try { setError(null); await orbit.writeFile(active.path, active.content); ws.markSaved(active.path); await refreshGit(); queuePersist(); }
    catch (e) { setError(`Save failed: ${String(e)}`); }
  }
  async function refreshExplorer() {
    if (!ws.root) return;
    try { ws.setEntries(await orbit.listDir(ws.root)); await refreshGit(); } catch (e) { setError(String(e)); }
  }

  useEffect(() => {
    if (restoredRef.current || !(window as any).__TAURI_INTERNALS__) return;
    restoredRef.current = true;
    (async () => {
      await loadRecent();
      const session = await workspaceApi.restoreSession().catch(() => null);
      if (session?.root) {
        try {
          await openWorkspacePath(session.root);
          for (const p of session.open_files || []) { try { await openFileByPath(p, false); } catch {} }
          if (session.active_path) ws.setActive(session.active_path);
        } catch (e) { setError(`Session restore: ${String(e)}`); }
      }
    })();
  }, []);

  useEffect(() => { queuePersist(); }, [ws.root, ws.activePath, ws.files.map((f) => `${f.path}:${f.content === f.saved}`).join("|")]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void saveActive(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o" && !e.shiftKey) { e.preventDefault(); void openFolder(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, ws.root]);

  if (showSplash) return <Splash onDone={() => setShowSplash(false)} />;

  return (
    <div className="orbit-app">
      <header className="header">
        <div className="brand" aria-label="ORBIT IDE">
          <span className="brand-mark" aria-hidden="true"><OrbitMark size={18} /></span>
          <span className="brand-name">ORBIT</span>
          <span className="brand-sub" title={ws.root || undefined}>{workspaceName}</span>
        </div>
        <button className="command" type="button" aria-label="Command search"><span>Search commands and files…</span><span className="command-kbd">Ctrl+P</span></button>
        <button className="icon-btn" type="button" title="Open Folder (Ctrl+O)" onClick={() => void openFolder()}><ExplorerIcon width={16} height={16} /></button>
        <button className="icon-btn" type="button" title="Save (Ctrl+S)" onClick={() => void saveActive()} disabled={!dirty}><SaveIcon width={16} height={16} /></button>
        <button className="icon-btn" type="button" title="Settings" onClick={() => setActivity("settings")}><SettingsIcon width={16} height={16} /></button>
      </header>
      <div className="main">
        <nav className="activity" aria-label="Activity bar">
          {activities.map((a) => { const Icon = a.icon; return <button key={a.id} type="button" className={`icon-btn ${activity === a.id ? "active" : ""}`} title={a.label} aria-label={a.label} aria-pressed={activity === a.id} onClick={() => setActivity(a.id)}><Icon width={20} height={20} /></button>; })}
        </nav>
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>{activities.find((a) => a.id === activity)?.label.toUpperCase()}</span>
            {activity === "explorer" && ws.root ? <button className="icon-btn" type="button" title="Refresh explorer and Git" onClick={() => void refreshExplorer()}><RefreshIcon width={15} height={15} /></button> : null}
          </div>
          <div className="sidebar-body">
            {activity === "explorer" ? <Explorer onOpenFolder={openFolder} /> :
             activity === "git" ? <div style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{ws.git?.is_repo ? `Branch: ${ws.git.branch || "(detached)"}\nChanged: ${ws.git.changed.length}\n\n${ws.git.changed.slice(0, 30).map((c) => `${c.staged ? "S" : " "} ${c.status} ${c.path}`).join("\n") || "Working tree clean."}\n\nOpen the Git History panel below for stage, commit, diff, and history.` : "No Git repository detected in this workspace."}</div> :
             activity === "search" ? <div className="empty-state"><p>Workspace search is planned.</p><p style={{ fontSize: 12 }}>Use file open and Git status for now.</p></div> :
             activity === "extensions" ? <ExtensionsAiPanel mode="extensions" /> :
             activity === "settings" ? <div style={{ height: "100%", overflow: "auto" }}><ExtensionsAiPanel mode="ai" /><div className="empty-state" style={{ paddingTop: 0 }}><div className="section-label">LANGUAGE INTELLIGENCE</div><p style={{ fontSize: 12, marginBottom: 10 }}>Optional LSP support is user-configured. ORBIT never downloads language servers automatically.</p><button className="btn" type="button" onClick={() => setPanel("problems")}>Open LSP Panel</button><div className="section-label">UPDATES</div><p style={{ fontSize: 12, marginBottom: 8 }}>Auto-update is opt-in. It uses Tauri's signed updater and only works after release endpoints/keys are configured. Update checks never run silently unless enabled.</p><label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 8 }}><input type="checkbox" checked={autoUpdate} onChange={async (e) => { const v = e.target.checked; setAutoUpdate(v); await setUpdaterConfig({ autoCheck: v, lastCheckedAt: Date.now() }); }} /> Check for updates on startup</label><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button className="btn" type="button" onClick={async () => { setUpdateStatus("Checking..."); const r = await checkForUpdate(); setUpdateStatus(r.status === "up_to_date" ? "ORBIT IDE is up to date." : r.status === "not_configured" ? "Updater not configured for this build/release." : r.status === "available" ? `Update ${"version" in r ? r.version : ""} available.` : r.status === "installing" ? "Installing update..." : "message" in r && r.message ? r.message : r.status); }}>{updateStatus === "Checking..." ? "Checking..." : "Check for Updates"}</button>{updateStatus ? <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{updateStatus}</span> : null}</div></div></div> :
             <div className="empty-state"><p>{activities.find((a) => a.id === activity)?.label} is planned for a later milestone.</p></div>}
            {error ? <div style={{ marginTop: 10, color: "var(--danger)", whiteSpace: "pre-wrap", fontSize: 12 }}>{error}</div> : null}
          </div>
        </aside>
        <section className="workbench" style={{ gridTemplateRows: panelOpen ? `minmax(0,1fr) ${panelH}px` : "minmax(0,1fr) 34px" }}>
          <div className="editor-area">
            <div className="tabs" role="tablist" aria-label="Open editors">
              {ws.files.length ? ws.files.map((f) => {
                const isDirty = f.content !== f.saved;
                return <button key={f.path} className={`tab ${ws.activePath === f.path ? "active" : ""}`} type="button" onClick={() => ws.setActive(f.path)} title={f.path}><span className="tab-label">{f.name}</span>{isDirty ? <span className="tab-dirty" aria-label="Unsaved changes">•</span> : null}<span className="tab-close" role="button" aria-label={`Close ${f.name}`} onClick={(e) => { e.stopPropagation(); ws.closeFile(f.path); queuePersist(); }}>×</span></button>;
              }) : <button className="tab active" type="button">Welcome</button>}
            </div>
            <div className="editor-surface">
              {active ? <OrbitEditor path={active.path} value={active.content} onChange={(v) => ws.updateContent(active.path, v)} onSave={() => void saveActive()} /> : (
                <div className="welcome"><div className="welcome-card">
                  <div className="welcome-orbit" aria-hidden="true"><OrbitMark size={40} /></div>
                  <h1>ORBIT IDE</h1>
                  <p className="tagline">Your code. Your environment. Your orbit.</p>
                  <p>Open a local folder, browse files, edit in Monaco, and save through native Rust services.</p>
                  <div className="actions">
                    <button className="btn primary" type="button" onClick={openFolder}>Open Folder</button>
                    {recent[0] ? <button className="btn" type="button" onClick={() => void openWorkspacePath(recent[0].path)} title={recent[0].path}>Open Recent</button> : null}
                  </div>
                  {recent.length ? <div style={{ marginTop: 14, textAlign: "left" }}><div className="section-label">RECENT WORKSPACES</div>{recent.slice(0, 8).map((r) => <div key={r.path} className="tree-row" title={r.path} style={{ cursor: "default" }}><button type="button" style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }} onClick={() => void openWorkspacePath(r.path)}><span className="tree-name">{r.name}</span></button><span style={{ color: "var(--text-faint)", fontSize: 11 }}>open</span><button type="button" className="icon-btn" title="Remove from recents" onClick={async (e) => { e.stopPropagation(); await workspaceApi.removeRecent(r.path).catch(() => {}); setRecent((list) => list.filter((x) => x.path !== r.path)); }}>×</button></div>)}</div> : null}
                  <div className="hint">Shortcuts: <code>Ctrl/Cmd+O</code> open folder · <code>Ctrl/Cmd+S</code> save</div>
                </div></div>
              )}
            </div>
          </div>
          <div className={`bottom ${panelOpen ? "" : "collapsed"}`} style={panelOpen ? { height: panelH } : undefined}>
            <div className="panel-tabs" role="tablist" aria-label="Panel tabs" onDoubleClick={() => setPanelOpen((v) => !v)}>
              {(["terminal", "problems", "output", "debug", "git-history", "receipts"] as PanelTab[]).map((t) => <button key={t} type="button" className={`panel-tab ${panel === t ? "active" : ""}`} onClick={() => { setPanel(t); setPanelOpen(true); }}>{{ terminal: "Terminal", problems: "Problems", output: "Output", debug: "Debug Console", "git-history": "Git History", receipts: "Receipts" }[t]}</button>)}
              <div className="panel-toolbar-actions">
                <button type="button" className="icon-btn" title={panelOpen ? "Collapse panel" : "Expand panel"} onClick={() => setPanelOpen((v) => !v)}>{panelOpen ? "▾" : "▴"}</button>
                <button type="button" className="icon-btn" title={panelH > 420 ? "Restore panel size" : "Maximize panel"} onClick={() => { setPanelOpen(true); setPanelH((h) => h > 420 ? 240 : Math.min(760, Math.floor(window.innerHeight * 0.62))); }}>{panelH > 420 ? "❐" : "□"}</button>
              </div>
            </div>
            <div className="panel-content">
              {panelOpen ? <div className={`resize-handle-y ${dragY != null ? "active" : ""}`} title="Drag to resize panel" onMouseDown={(e) => { e.preventDefault(); const startY = e.clientY; const startH = panelH; setDragY(startY); const move = (ev: MouseEvent) => setPanelH(Math.max(140, Math.min(Math.floor(window.innerHeight * 0.78), startH + (startY - ev.clientY)))); const up = () => { setDragY(null); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }} /> : null}
              {panel === "terminal" ? <div className="panel-view"><TerminalPanel cwd={ws.root} expanded={panelH > 420} /></div>
               : panel === "git-history" ? <div className="panel-view"><GitPanel root={ws.root} onChanged={() => { void refreshGit(); void refreshExplorer(); }} /></div>
               : panel === "problems" ? <div className="panel-view"><LspPanel /></div>
               : panel === "receipts" ? <div className="panel-view"><ReceiptsPanel /></div>
               : <div className="panel-body panel-view">{panel === "output" ? (error ? `Last error:\n${error}` : "Output channel ready.") : "Debug console is planned for a later milestone."}</div>}
            </div>
          </div>
        </section>
      </div>
      <footer className="status">
        <div className="left"><span className="status-item pill"><GitIcon width={13} height={13} /> {ws.git?.is_repo ? (ws.git.branch || "detached") : "no git"}</span><span className="status-item" title={ws.root || ""}>{workspaceName}</span>{dirty ? <span className="status-item pill warn">Unsaved</span> : null}</div>
        <div className="right"><span className="status-item">UTF-8</span><span className="status-item">Spaces: 2</span><span className="status-item">{active ? active.name.split(".").pop()?.toUpperCase() || "TEXT" : "PLAIN TEXT"}</span></div>
      </footer>
    </div>
  );
}
