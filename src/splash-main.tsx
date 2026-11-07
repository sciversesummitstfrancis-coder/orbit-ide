import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./splash.css";

type InitEvent = { step?: string; message?: string; progress?: number; error?: string };
type Stage = { id: string; label: string; at: number };

const MIN_VISIBLE_MS = 2200;
const MAX_WAIT_MS = 12000;
const READY_HOLD_MS = 560;
const EXIT_MS = 520;

const STAGES: Stage[] = [
  { id: "system", label: "INITIALIZING SYSTEM", at: 0 },
  { id: "environment", label: "ESTABLISHING ENVIRONMENT", at: 18 },
  { id: "modules", label: "LOADING CORE MODULES", at: 38 },
  { id: "sync", label: "SYNCHRONIZING COMPONENTS", at: 58 },
  { id: "workspace", label: "PREPARING WORKSPACE", at: 78 },
  { id: "online", label: "SYSTEM ONLINE", at: 100 },
];

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function stageForProgress(p: number) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (p >= STAGES[i].at) idx = i;
  return idx;
}
function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

function SplashApp() {
  const [progress, setProgress] = useState(6);
  const [displayProgress, setDisplayProgress] = useState(6);
  const [message, setMessage] = useState(STAGES[0].label);
  const [phase, setPhase] = useState<"in" | "run" | "ready" | "out" | "error">("in");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const startedAt = useRef(Date.now());
  const readyTimer = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const completed = useRef(false);
  const progressRef = useRef(6);
  const displayRef = useRef(6);
  const reduced = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false, []);

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => {
    const animate = () => {
      const target = progressRef.current;
      const cur = displayRef.current;
      const next = Math.abs(target - cur) < 0.15 ? target : cur + (target - cur) * (reduced ? 1 : 0.16);
      displayRef.current = next;
      setDisplayProgress(next);
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setTick((v) => (v + 1) % 100000), 90);
    return () => window.clearInterval(t);
  }, [reduced]);

  const stageIndex = stageForProgress(displayProgress);
  const ringR = 44;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - clamp(displayProgress, 0, 100) / 100);
  const scanX = (displayProgress % 100) * 4.96;

  async function revealMain() {
    if (completed.current) return;
    completed.current = true;
    setProgress(100);
    setMessage("SYSTEM ONLINE");
    setPhase("ready");
    window.clearTimeout(maxTimer.current ?? undefined);
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(READY_HOLD_MS, MIN_VISIBLE_MS - elapsed);
    readyTimer.current = window.setTimeout(async () => {
      setPhase("out");
      window.setTimeout(async () => {
        try { await invoke("show_main_window"); }
        catch (e) { setError(String(e)); setPhase("error"); completed.current = false; }
      }, reduced ? 80 : EXIT_MS);
    }, wait);
  }

  useEffect(() => {
    const current = getCurrentWindow();
    const unsubs: Array<() => void> = [];
    const on = async (name: string, fn: (p: InitEvent) => void) => {
      try { unsubs.push(await listen<InitEvent>(name, (e) => fn(e.payload || {}))); } catch {}
    };

    void on("app://init-progress", (p) => {
      if (completed.current) return;
      setPhase((ph) => ph === "in" ? "run" : ph);
      if (typeof p.progress === "number") setProgress((v) => clamp(Math.max(v, p.progress!), 0, 99));
      if (p.message) setMessage(p.message.toUpperCase());
    });
    void on("app://init-complete", (p) => {
      if (typeof p.progress === "number") setProgress((v) => Math.max(v, p.progress!));
      if (p.message) setMessage(p.message.toUpperCase());
      void revealMain();
    });
    void on("app://init-error", (p) => {
      setError(p.error || p.message || "Startup failed");
      setPhase("error");
      setProgress((v) => Math.max(v, 92));
    });

    const kick = window.setTimeout(async () => {
      setPhase((ph) => ph === "in" ? "run" : ph);
      setProgress((v) => Math.max(v, 12));
      setMessage(STAGES[0].label);
      try { await invoke("splash_ready"); } catch (e) { setError(String(e)); setPhase("error"); }
    }, reduced ? 20 : 100);

    maxTimer.current = window.setTimeout(() => {
      if (!completed.current && phase !== "error") void revealMain();
    }, MAX_WAIT_MS);

    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(maxTimer.current ?? undefined);
      window.clearTimeout(readyTimer.current ?? undefined);
      unsubs.forEach((u) => u());
      void current;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function continueAnyway() { setError(null); completed.current = false; await revealMain(); }
  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ i, x: 8 + (i * 7.3) % 84, d: 2.8 + (i % 5) * 0.55, delay: (i * 0.23) % 2.4, s: 1 + (i % 3) * 0.6 })), []);
  const code = ["SYS:BOOT", "NET:OK", "FS:RDY", "UI:SYNC", `SEQ:${String(stageIndex + 1).padStart(2, "0")}/${STAGES.length - 1}`, `PWR:${Math.round(displayProgress)}%`];

  return (
    <div className={`splash-root phase-${phase} stage-${stageIndex} ${reduced ? "reduced" : ""}`} aria-label="ORBIT IDE startup">
      <div className="bg-grid" />
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="scanline" style={{ transform: `translateY(${18 + (displayProgress * 2.65)}px)` }} />
      <div className="particles" aria-hidden>{particles.map((p) => <span key={p.i} style={{ left: `${p.x}%`, animationDuration: `${p.d}s`, animationDelay: `${p.delay}s`, width: p.s, height: p.s, opacity: 0.18 + (p.i % 4) * 0.08 }} />)}</div>
      <div className="card" role="status" aria-live="polite">
        <div className="hud-corner hud-tl" /><div className="hud-corner hud-tr" /><div className="hud-corner hud-bl" /><div className="hud-corner hud-br" />
        <div className="topbar">
          <span className="chip"><i className="dot" />ORBIT CORE</span>
          <span className="chip mono">{code[(tick / 7 | 0) % code.length]}</span>
          <span className="chip">BOOT SEQ {String(stageIndex + 1).padStart(2, "0")}</span>
        </div>
        <div className="main">
          <div className="emblem" aria-hidden>
            <svg viewBox="0 0 120 120" className="emblem-svg">
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgba(125,211,252,.85)" /><stop offset="1" stopColor="rgba(167,139,250,.7)" /></linearGradient>
              </defs>
              <polygon points={hexPoints(60,60,52)} className="hex hex-a" />
              <polygon points={hexPoints(60,60,40)} className="hex hex-b" />
              <circle cx="60" cy="60" r={ringR} className="ring-bg" />
              <circle cx="60" cy="60" r={ringR} className="ring-fg" strokeDasharray={ringC} strokeDashoffset={ringOffset} />
              <g className="orbit-spin"><ellipse cx="60" cy="60" rx="29" ry="12" className="orbit" /><circle cx="89" cy="60" r="2.5" className="node" /></g>
              <g className="orbit-spin rev"><ellipse cx="60" cy="60" rx="12" ry="29" className="orbit soft" /><circle cx="60" cy="31" r="2" className="node soft" /></g>
              <circle cx="60" cy="60" r="6" className="core" />
              <path d={`M18 60 H${22 + scanX * 0.16}`} className="scan-arm" />
            </svg>
            <div className="emblem-readout mono">{Math.round(displayProgress)}%</div>
          </div>
          <div className="brand-block">
            <div className="brand-kicker">LAUNCH PROTOCOL</div>
            <div className="brand-name">ORBIT IDE</div>
            <div className="brand-sub">Native workspace activation sequence</div>
            <div className="stage-list" aria-hidden>
              {STAGES.filter((s) => s.id !== "online").map((s, i) => {
                const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
                return <div key={s.id} className={`stage ${state}`}><span className="stage-mark">{state === "done" ? "■" : state === "active" ? "▣" : "□"}</span><span>{s.label}</span></div>;
              })}
              <div className={`stage ${stageIndex >= STAGES.length - 1 ? "active online" : "pending"}`}><span className="stage-mark">{stageIndex >= STAGES.length - 1 ? "◆" : "◇"}</span><span>SYSTEM ONLINE</span></div>
            </div>
          </div>
        </div>
        <div className="status-row">
          <span className="status-text"><span className="status-prefix">{error ? "FAULT" : stageIndex >= STAGES.length - 1 ? "ONLINE" : "ACTIVE"}</span>{error ? "STARTUP EXCEPTION" : message}</span>
          <span className="status-pct mono">{String(Math.round(displayProgress)).padStart(3, "0")}%</span>
        </div>
        <div className="progress" aria-hidden>
          <div className="progress-fill" style={{ transform: `scaleX(${clamp(displayProgress, 0, 100) / 100})` }} />
          <div className="progress-ticks">{Array.from({ length: 20 }, (_, i) => <span key={i} />)}</div>
        </div>
        {error ? (
          <div className="error"><div className="error-text">{error}</div><button type="button" className="error-btn" onClick={() => void continueAnyway()}>CONTINUE</button></div>
        ) : null}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><SplashApp /></React.StrictMode>
);
