import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { orbit } from "../services/orbit";

type Session = { id: string; term: Terminal; fit: FitAddon; wrap: HTMLDivElement; ro?: ResizeObserver };
const ORBIT_THEME = {
  background: "#11161c", foreground: "#dce7f1", cursor: "#22d3ee", cursorAccent: "#11161c",
  selectionBackground: "#22d3ee33", black: "#11161c", red: "#f87171", green: "#4ade80",
  yellow: "#fbbf24", blue: "#60a5fa", magenta: "#a78bfa", cyan: "#22d3ee", white: "#dce7f1",
  brightBlack: "#4f6478", brightWhite: "#f3f8fc",
};

export default function TerminalPanel({ cwd }: { cwd: string | null }) {
  const [sessions, setSessions] = useState<{ id: string; label: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionsRef = useRef<Map<string, Session>>(new Map());
  const hostRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef(0);
  const initRef = useRef(false);

  function fitSession(id: string) {
    const s = sessionsRef.current.get(id);
    const host = hostRef.current;
    if (!s || !host || s.wrap.style.display === "none") return;
    if (host.clientWidth < 20 || host.clientHeight < 20) return;
    try { s.fit.fit(); void orbit.termResize(id, Math.max(2, s.term.cols), Math.max(2, s.term.rows)).catch(() => {}); } catch {}
  }

  async function createSession() {
    const host = hostRef.current;
    if (!host) return;
    try {
      setError(null);
      const info = await orbit.termCreate(cwd, 80, 24);
      if (!hostRef.current) { void orbit.termKill(info.id).catch(() => {}); return; }
      if (sessionsRef.current.has(info.id)) return;
      labelRef.current += 1;
      const term = new Terminal({
        cursorBlink: true, fontFamily: '"JetBrains Mono","Cascadia Code","Fira Code",Consolas,monospace',
        fontSize: 13, lineHeight: 1.2, theme: ORBIT_THEME, scrollback: 5000, allowProposedApi: false,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.onData((data) => { void orbit.termWrite(info.id, data).catch((e) => setError(String(e))); });

      const wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;inset:0;display:none;padding:4px 0 0 8px;overflow:hidden;background:#11161c;";
      host.appendChild(wrap);
      term.open(wrap);
      const session: Session = { id: info.id, term, fit, wrap };
      sessionsRef.current.set(info.id, session);
      setSessions((s) => s.some((x) => x.id === info.id) ? s : [...s, { id: info.id, label: `Terminal ${labelRef.current}` }]);
      setActiveId(info.id);

      const ro = new ResizeObserver(() => fitSession(info.id));
      ro.observe(host);
      session.ro = ro;
      [0, 50, 150].forEach((ms) => setTimeout(() => { fitSession(info.id); if (ms === 150) term.focus(); }, ms));
    } catch (e) {
      const msg = String(e);
      setError(msg.includes("__TAURI") || msg.includes("invoke") ? "Terminal requires the ORBIT desktop app (npm run tauri dev). It cannot run in a plain browser tab." : msg);
    }
  }

  async function killActive() {
    if (!activeId) return;
    await orbit.termKill(activeId).catch(() => {});
    const s = sessionsRef.current.get(activeId);
    s?.ro?.disconnect(); s?.term.dispose(); s?.wrap.remove(); sessionsRef.current.delete(activeId);
    setSessions((list) => {
      const next = list.filter((x) => x.id !== activeId);
      setActiveId((cur) => (cur === activeId ? next[next.length - 1]?.id ?? null : cur));
      return next;
    });
  }

  useEffect(() => {
    let unData: (() => void) | undefined, unExit: (() => void) | undefined, disposed = false;
    orbit.onTermData(({ id, data }) => { if (!disposed) sessionsRef.current.get(id)?.term.write(data); })
      .then((u) => { if (disposed) u(); else unData = u; }).catch(() => {});
    orbit.onTermExit(({ id }) => { if (!disposed) sessionsRef.current.get(id)?.term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n"); })
      .then((u) => { if (disposed) u(); else unExit = u; }).catch(() => {});
    return () => {
      disposed = true; unData?.(); unExit?.();
      sessionsRef.current.forEach((s) => { s.ro?.disconnect(); s.term.dispose(); s.wrap.remove(); void orbit.termKill(s.id).catch(() => {}); });
      sessionsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    sessionsRef.current.forEach((s, id) => {
      const active = id === activeId;
      s.wrap.style.display = active ? "block" : "none";
      if (active) { fitSession(id); s.term.focus(); }
    });
  }, [activeId, sessions.length]);

  useEffect(() => { if (initRef.current) return; initRef.current = true; void createSession(); }, []);

  return (
    <div className="terminal-panel">
      <div className="terminal-toolbar">
        <div className="terminal-tabs">
          {sessions.map((s) => (
            <button key={s.id} type="button" className={`panel-tab ${activeId === s.id ? "active" : ""}`} onClick={() => setActiveId(s.id)}>{s.label}</button>
          ))}
        </div>
        <button type="button" className="icon-btn" title="New terminal" onClick={() => void createSession()}>+</button>
        <button type="button" className="icon-btn" title="Kill terminal" onClick={() => void killActive()} disabled={!activeId}>×</button>
        <span className="terminal-meta">{cwd ? cwd.split(/[/\\]/).filter(Boolean).pop() || cwd : "shell"}</span>
      </div>
      <div className="terminal-host" ref={hostRef} />
      {error ? <div className="terminal-error">{error}</div> : null}
    </div>
  );
}
