import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./splash.css";

type InitEvent = { step?: string; message?: string; progress?: number; error?: string };
type BootStage = { id: string; title: string; subtitle: string; at: number; end: number; modules?: string[]; diag?: string[] };

const TARGET_CINEMATIC_MS = 34000;
const MIN_CINEMATIC_MS = 4800; // when app ready very fast, still show a brief but complete-feeling finale
const READY_HOLD_MS = 900;
const EXIT_MS = 560;
const MAX_WAIT_MS = 90000;

const STAGES: BootStage[] = [
  { id:"awakening", title:"SYSTEM AWAKENING", subtitle:"Signal acquisition and identity lock", at:0, end:16,
    diag:["Power rails stable","Display compositor linked","Trusted runtime sealed"] },
  { id:"core", title:"CORE INITIALIZATION", subtitle:"Diagnostics, storage, and native services", at:16, end:36,
    diag:["SQLite vault online","Service registry mounted","Security capabilities verified"] },
  { id:"sync", title:"MODULE SYNCHRONIZATION", subtitle:"Subsystem handshakes and channel binding", at:36, end:58,
    modules:["FILESYSTEM","TERMINAL PTY","GIT BRIDGE","LSP TRANSPORT","AI ADAPTER","TIME MACHINE"] },
  { id:"env", title:"ENVIRONMENT PREPARATION", subtitle:"Workspace context and interface assembly", at:58, end:80,
    diag:["Workspace state indexed","Panel graph assembled","Editor surface primed"] },
  { id:"final", title:"FINAL ACTIVATION", subtitle:"Full system synchronization", at:80, end:100,
    diag:["All channels synchronized","Focus authority transferred","Launch vector confirmed"] },
];

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function ease(t: number) { return 1 - Math.pow(1 - clamp(t,0,1), 3); }
function stageFor(p: number) { let i=0; for (let s=0;s<STAGES.length;s++) if (p>=STAGES[s].at) i=s; return i; }
function hex(cx:number,cy:number,r:number){ return Array.from({length:6},(_,i)=>{const a=(Math.PI/180)*(60*i-30); return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;}).join(" "); }

function SplashApp() {
  const [actualProgress, setActualProgress] = useState(4); // real init from backend
  const [actualReady, setActualReady] = useState(false);
  const [visualProgress, setVisualProgress] = useState(0);
  const [message, setMessage] = useState("SYSTEM AWAKENING");
  const [phase, setPhase] = useState<"in"|"run"|"ready"|"out"|"error">("in");
  const [error, setError] = useState<string|null>(null);
  const [tick, setTick] = useState(0);
  const [cinematicDone, setCinematicDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const startedAt = useRef(Date.now());
  const actualRef = useRef(4);
  const visualRef = useRef(0);
  const readyRef = useRef(false);
  const revealed = useRef(false);
  const maxTimer = useRef<number|null>(null);
  const raf = useRef<number|null>(null);
  const reduced = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false, []);

  useEffect(()=>{ actualRef.current = actualProgress; },[actualProgress]);
  useEffect(()=>{ readyRef.current = actualReady; },[actualReady]);

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setTick(v => (v+1)%100000), 100);
    return () => window.clearInterval(t);
  }, [reduced]);

  // Visual progress: choreographed over TARGET_CINEMATIC_MS but never exceeds actual progress ceiling
  // (except it can approach the ceiling smoothly). When actual is complete, we can advance to finale.
  useEffect(() => {
    const loop = () => {
      const elapsed = Date.now() - startedAt.current;
      const t = clamp(elapsed / TARGET_CINEMATIC_MS, 0, 1);
      const targetCinematic = ease(t) * 100;
      const actual = actualRef.current;
      const ready = readyRef.current || skipped;
      // Progress reflects real initialization: visual cannot claim completion before actual ready,
      // and it tracks actual as a ceiling with cinematic pacing below it.
      let ceiling = ready ? 100 : Math.max(8, Math.min(99, actual + 12));
      let next = Math.min(targetCinematic, ceiling);
      // If actual finished early and user hasn't skipped, let finale play briefly but not to 40s.
      if (ready && !skipped) {
        // App is ready: accelerate finale; MIN_CINEMATIC_MS/TARGET pacing prevents an abrupt cut.
        next = Math.max(next, Math.min(100, visualRef.current + (reduced ? 100 : 1.1)));
        void elapsed; void MIN_CINEMATIC_MS;
      }
      if (skipped) next = 100;
      next = clamp(next, 0, 100);
      const cur = visualRef.current;
      const smoothed = Math.abs(next-cur) < 0.05 ? next : cur + (next-cur) * (reduced ? 1 : 0.11);
      visualRef.current = smoothed;
      setVisualProgress(smoothed);
      if (smoothed >= 99.6 && (ready || skipped)) setCinematicDone(true);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [reduced, skipped]);

  async function revealMain(reason: string) {
    if (revealed.current) return;
    revealed.current = true;
    setPhase("ready");
    setMessage("SYSTEM ONLINE");
    window.clearTimeout(maxTimer.current ?? undefined);
    const hold = skipped ? 180 : READY_HOLD_MS;
    window.setTimeout(() => {
      setPhase("out");
      window.setTimeout(async () => {
        try { await invoke("show_main_window"); }
        catch (e) { setError(String(e)); setPhase("error"); revealed.current = false; }
      }, reduced ? 80 : EXIT_MS);
    }, hold);
    void reason;
  }

  useEffect(() => {
    if (!cinematicDone || revealed.current) return;
    if (actualReady || skipped) void revealMain("complete");
  }, [cinematicDone, actualReady, skipped]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const on = async (name: string, fn: (p: InitEvent) => void) => {
      try { unsubs.push(await listen<InitEvent>(name, (e) => fn(e.payload || {}))); } catch {}
    };
    void on("app://init-progress", (p) => {
      if (revealed.current) return;
      setPhase(ph => ph === "in" ? "run" : ph);
      if (typeof p.progress === "number") setActualProgress(v => clamp(Math.max(v, p.progress!), 0, 100));
      if (p.message) setMessage(p.message.toUpperCase());
    });
    void on("app://init-complete", (p) => {
      if (typeof p.progress === "number") setActualProgress(100);
      setActualReady(true);
      if (p.message) setMessage(p.message.toUpperCase());
    });
    void on("app://init-error", (p) => {
      setError(p.error || p.message || "Startup failed");
      setPhase("error");
      setActualProgress(v => Math.max(v, 88));
    });
    const kick = window.setTimeout(async () => {
      setPhase(ph => ph === "in" ? "run" : ph);
      setActualProgress(v => Math.max(v, 8));
      try { await invoke("splash_ready"); } catch (e) { setError(String(e)); setPhase("error"); }
    }, reduced ? 20 : 120);
    maxTimer.current = window.setTimeout(() => { if (!revealed.current) { setActualReady(true); setSkipped(true); } }, MAX_WAIT_MS);
    return () => { window.clearTimeout(kick); window.clearTimeout(maxTimer.current ?? undefined); unsubs.forEach(u=>u()); };
  }, []); // eslint-disable-line

  const p = visualProgress;
  const si = stageFor(p);
  const stage = STAGES[si];
  const local = clamp((p - stage.at) / Math.max(1, stage.end - stage.at), 0, 1);
  const ringR = 42, ringC = 2*Math.PI*ringR, ringOff = ringC*(1-p/100);
  const particles = useMemo(() => Array.from({length:16},(_,i)=>({ i, x:6+(i*6.4)%88, d:3.2+(i%6)*.7, delay:(i*.19)%3, s:1+(i%3)*.7 })), []);
  const modules = STAGES[2].modules || [];
  const moduleStates = modules.map((m,i)=> ({ m, state: si < 2 ? "standby" : si === 2 ? (i < Math.ceil(local*modules.length) ? "active":"pending") : "online" }));
  const diag = stage.diag || STAGES[2].diag || [];
  const diagActive = Math.floor(local * diag.length) + (local > 0.95 ? 1 : 0);
  const canSkip = !error && !revealed.current;
  const statusCode = error ? "FAULT" : si >= 4 && actualReady ? "ONLINE" : "ACTIVE";

  return (
    <div className={`splash-root phase-${phase} stage-${stage.id} ${reduced?"reduced":""} ${actualReady?"app-ready":""}`} aria-label="ORBIT IDE startup">
      <div className="bg-grid" /><div className="ambient ambient-a" /><div className="ambient ambient-b" />
      <div className="scanline" style={{ transform:`translateY(${14 + p*2.72}px)`, opacity: si>=1?.5:.2 }} />
      <div className="sweep-global" style={{ opacity: si===4?.7:.18 }} />
      <div className="particles" aria-hidden>{particles.map(pt=><span key={pt.i} style={{ left:`${pt.x}%`, animationDuration:`${pt.d}s`, animationDelay:`${pt.delay}s`, width:pt.s, height:pt.s }} />)}</div>
      <div className="card" role="status" aria-live="polite">
        <div className="hud-corner hud-tl" /><div className="hud-corner hud-tr" /><div className="hud-corner hud-bl" /><div className="hud-corner hud-br" />
        <div className="topbar">
          <span className="chip"><i className={`dot ${actualReady?"ready":""}`} />ORBIT CORE</span>
          <span className="chip mono">STAGE {String(si+1).padStart(2,"0")}/05</span>
          <span className="chip mono">{actualReady ? "APP READY" : "BOOTING"}</span>
          {canSkip ? <button type="button" className="skip" onClick={()=>setSkipped(true)}>SKIP</button> : <span className="chip mono">{statusCode}</span>}
        </div>

        <div className="layout">
          <div className="emblem-col">
            <div className={`emblem ${si===4?"finale":""}`} aria-hidden>
              <svg viewBox="0 0 120 120" className="emblem-svg">
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgba(143,220,255,.9)" /><stop offset="1" stopColor="rgba(183,166,255,.75)" /></linearGradient>
                  <filter id="glow"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <polygon points={hex(60,60,54)} className="hex hex-a" style={{ opacity: .12 + p/180 }} />
                <polygon points={hex(60,60,48)} className="hex hex-b" style={{ opacity: p>10?.18:0 }} />
                <polygon points={hex(60,60,36)} className="hex hex-c" style={{ opacity: si>=2?.14:0 }} />
                <circle cx="60" cy="60" r={ringR} className="ring-bg" />
                <circle cx="60" cy="60" r={ringR} className="ring-fg" strokeDasharray={ringC} strokeDashoffset={ringOff} filter={si>=4?"url(#glow)":undefined} />
                <circle cx="60" cy="60" r="30" className="ring-inner" style={{ strokeDasharray:188, strokeDashoffset:188*(1-local) }} />
                {si>=1 ? <g className="orbit-spin"><ellipse cx="60" cy="60" rx="28" ry="11" className="orbit" /><circle cx="88" cy="60" r="2.4" className="node" /></g> : null}
                {si>=2 ? <g className="orbit-spin rev"><ellipse cx="60" cy="60" rx="11" ry="28" className="orbit soft" /><circle cx="60" cy="32" r="2" className="node soft" /></g> : null}
                {si>=3 ? <g className="radar" style={{ transformOrigin:"60px 60px", transform:`rotate(${tick*3.6}deg)` }}><path d="M60 60 L60 20 A40 40 0 0 1 88 34 Z" fill="rgba(143,220,255,.06)" /></g> : null}
                <circle cx="60" cy="60" r={si===4?7.5:6} className="core" filter="url(#glow)" />
                {si>=1 ? Array.from({length:8},(_,idx)=>{const a=(Math.PI*2*idx)/8, r1=52,r2=56; return <line key={idx} x1={60+Math.cos(a)*r1} y1={60+Math.sin(a)*r1} x2={60+Math.cos(a)*r2} y2={60+Math.sin(a)*r2} className={`tick ${idx/8 < p/100 ? "on":""}`} />;}) : null}
              </svg>
              <div className="emblem-readout mono">{String(Math.round(p)).padStart(3,"0")}%</div>
            </div>
            <div className="diag-strip mono" aria-hidden>
              {(diag.length?diag:["System link pending"]).map((d,i)=><div key={d} className={`diag ${i < diagActive ? "on":""}`}><span>{i < diagActive ? "OK":"··"}</span>{d}</div>)}
            </div>
          </div>

          <div className="content-col">
            <div className="kicker mono">LAUNCH PROTOCOL · ORBIT IDE</div>
            <div className="title">{stage.title}</div>
            <div className="subtitle">{stage.subtitle}</div>
            <div className="stage-track" aria-hidden>
              {STAGES.map((s,i)=>{const st=i<si?"done":i===si?"active":"pending"; return <div key={s.id} className={`track ${st}`}><span className="track-n">{String(i+1).padStart(2,"0")}</span><span className="track-bar"><i style={{ transform:`scaleX(${i<si?1:i===si?local:0})` }} /></span><span className="track-l">{s.title}</span></div>;})}
            </div>
            <div className={`module-grid ${si>=2?"show":""}`} aria-hidden>
              {moduleStates.map((ms)=><div key={ms.m} className={`mod ${ms.state}`}><span className="mod-led" /><span className="mod-name">{ms.m}</span><span className="mod-state mono">{ms.state==="online"?"SYNCED":ms.state==="active"?"LINKING":"STANDBY"}</span></div>)}
            </div>
          </div>
        </div>

        <div className="footer">
          <div className="status-line"><span className={`prefix mono ${actualReady?"ready":""}`}>{statusCode}</span><span className="msg">{error ? "STARTUP EXCEPTION" : message}</span>{actualReady && !skipped && si < 4 ? <span className="ready-note mono">APP READY · FINALIZING SEQUENCE</span> : null}</div>
          <div className="progress-wrap">
            <div className="progress-meta mono"><span>REAL INIT {Math.round(actualProgress)}%</span><span>SEQUENCE {String(Math.round(p)).padStart(3,"0")}%</span></div>
            <div className="progress" aria-hidden><div className="fill actual" style={{ transform:`scaleX(${clamp(actualProgress,0,100)/100})` }} /><div className="fill visual" style={{ transform:`scaleX(${clamp(p,0,100)/100})` }} /><div className="ticks">{Array.from({length:24},(_,i)=><span key={i}/>)}</div></div>
          </div>
        </div>
        {error ? <div className="error"><div className="error-text">{error}</div><button type="button" className="error-btn" onClick={()=>{setError(null); revealed.current=false; void revealMain("continue");}}>CONTINUE</button></div> : null}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<React.StrictMode><SplashApp /></React.StrictMode>);
