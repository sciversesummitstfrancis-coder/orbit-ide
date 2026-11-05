import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { orbit } from "../services/orbit";

type Session = { id: string; term: Terminal; fit: FitAddon; container: HTMLDivElement | null };
const ORBIT_THEME = { background: "#11161c", foreground: "#dce7f1", cursor: "#22d3ee", selectionBackground: "#22d3ee33", black: "#11161c", red: "#f87171", green: "#4ade80", yellow: "#fbbf24", blue: "#60a5fa", magenta: "#a78bfa", cyan: "#22d3ee", white: "#dce7f1" };

export default function TerminalPanel({ cwd }: { cwd: string | null }) {
  const [sessions, setSessions] = useState<{ id: string; label: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionsRef = useRef<Map<string, Session>>(new Map());
  const hostRef = useRef<HTMLDivElement | null>(null);

  function attachResize(id: string) {
    const sess = sessionsRef.current.get(id); const host = hostRef.current;
    if (!sess || !host) return;
    const ro = new ResizeObserver(() => {
      if (sess.container?.style.display === "none") return;
      try { sess.fit.fit(); void orbit.termResize(id, sess.term.cols, sess.term.rows); } catch {}
    });
    ro.observe(host);
  }

  async function createSession() {
    try {
      setError(null);
      const info = await orbit.termCreate(cwd, 100, 28);
      const term = new Terminal({ cursorBlink: true, fontFamily: '"JetBrains Mono","Cascadia Code",Consolas,monospace', fontSize: 12, theme: ORBIT_THEME, convertEol: false, scrollback: 5000 });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.onData((data) => { void orbit.termWrite(info.id, data).catch((e) => setError(String(e))); });
      sessionsRef.current.set(info.id, { id: info.id, term, fit, container: null });
      setSessions((s) => [...s, { id: info.id, label: `Terminal ${s.length + 1}` }]);
      setActiveId(info.id);
      requestAnimationFrame(() => {
        const host = hostRef.current; const sess = sessionsRef.current.get(info.id);
        if (!host || !sess) return;
        const wrap = document.createElement("div");
        wrap.style.height = "100%"; wrap.style.display = "none";
        host.appendChild(wrap); sess.container = wrap; term.open(wrap);
        fit.fit(); wrap.style.display = "block";
        void orbit.termResize(info.id, term.cols, term.rows).catch(() => {});
        attachResize(info.id);
        term.focus();
      });
    } catch (e) { setError(String(e)); }
  }

  async function killActive() {
    if (!activeId) return;
    await orbit.termKill(activeId).catch(() => {});
    const s = sessionsRef.current.get(activeId);
    s?.term.dispose(); s?.container?.remove(); sessionsRef.current.delete(activeId);
    setSessions((list) => list.filter((x) => x.id !== activeId));
    setActiveId((cur) => (cur === activeId ? sessions.find((x) => x.id !== activeId)?.id ?? null : cur));
  }

  useEffect(() => {
    let unData: (() => void) | undefined; let unExit: (() => void) | undefined;
    orbit.onTermData(({ id, data }) => sessionsRef.current.get(id)?.term.write(data)).then((u) => (unData = u));
    orbit.onTermExit(({ id }) => sessionsRef.current.get(id)?.term.write("\r\n[process exited]\r\n")).then((u) => (unExit = u));
    return () => { unData?.(); unExit?.(); sessionsRef.current.forEach((s) => { s.term.dispose(); s.container?.remove(); }); sessionsRef.current.clear(); };
  }, []);

  useEffect(() => {
    sessionsRef.current.forEach((s, id) => {
      if (!s.container) return;
      const active = id === activeId;
      s.container.style.display = active ? "block" : "none";
      if (active) { try { s.fit.fit(); void orbit.termResize(id, s.term.cols, s.term.rows); s.term.focus(); } catch {} }
    });
  }, [activeId, sessions]);

  useEffect(() => { if (!sessions.length) void createSession(); }, []);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "30px 1fr", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderBottom: "1px solid var(--border-subtle)", overflowX: "auto" }}>
        {sessions.map((s) => (
          <button key={s.id} type="button" className={`panel-tab ${activeId === s.id ? "active" : ""}`} onClick={() => setActiveId(s.id)}>{s.label}</button>
        ))}
        <button type="button" className="icon-btn" title="New terminal" onClick={() => void createSession()}>+</button>
        <button type="button" className="icon-btn" title="Kill terminal" onClick={() => void killActive()} disabled={!activeId}>×</button>
        <span style={{ marginLeft: "auto", color: "var(--text-faint)", fontSize: 11, whiteSpace: "nowrap" }}>{cwd ? `cwd: ${cwd.split(/[/\\]/).filter(Boolean).pop() || cwd}` : "default shell"}</span>
        {error ? <span style={{ color: "var(--danger)", fontSize: 11 }}>{error}</span> : null}
      </div>
      <div ref={hostRef} style={{ minHeight: 0, background: "#11161c", padding: "4px 0 0 6px" }} />
    </div>
  );
}
