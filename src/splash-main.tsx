import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./splash.css";

type InitEvent = { step?: string; message?: string; progress?: number; error?: string };
type Stage = { id: string; label: string; detail: string; at: number; end: number };

const TARGET_CINEMATIC_MS = 34000;
const MIN_READY_REVEAL_MS = 5200;
const READY_HOLD_MS = 820;
const EXIT_MS = 560;
const MAX_WAIT_MS = 90000;

const STAGES: Stage[] = [
  { id: "awakening", label: "System awakening", detail: "Preparing a secure launch context", at: 0, end: 18 },
  { id: "core", label: "Core initialization", detail: "Starting native services and storage", at: 18, end: 38 },
  { id: "sync", label: "Module synchronization", detail: "Connecting editor, terminal, and workspace systems", at: 38, end: 60 },
  { id: "environment", label: "Environment preparation", detail: "Restoring your local workspace state", at: 60, end: 82 },
  { id: "activation", label: "Final activation", detail: "Completing startup checks", at: 82, end: 100 },
];

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function easeOutCubic(t: number) { const x = clamp(t, 0, 1); return 1 - Math.pow(1 - x, 3); }
function stageIndexFor(progress: number) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (progress >= STAGES[i].at) idx = i;
  return idx;
}

function SplashApp() {
  const [actualProgress, setActualProgress] = useState(6);
  const [actualReady, setActualReady] = useState(false);
  const [visualProgress, setVisualProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Starting ORBIT IDE");
  const [phase, setPhase] = useState<"in" | "run" | "ready" | "out" | "error">("in");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  const startedAt = useRef(Date.now());
  const actualRef = useRef(6);
  const visualRef = useRef(0);
  const revealed = useRef(false);
  const raf = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);

  const reduced = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
    []
  );

  useEffect(() => { actualRef.current = actualProgress; }, [actualProgress]);

  useEffect(() => {
    const loop = () => {
      const elapsed = Date.now() - startedAt.current;
      const cinematicTarget = easeOutCubic(clamp(elapsed / TARGET_CINEMATIC_MS, 0, 1)) * 100;
      const actual = actualRef.current;
      const ready = actualReady || skipped;

      // Progress reflects real initialization: visuals pace the sequence but never claim
      // completion before actual readiness, and never outrun real progress by much.
      const ceiling = ready ? 100 : Math.max(10, Math.min(99, actual + 10));
      let next = Math.min(cinematicTarget, ceiling);
      if (ready && !skipped) next = Math.max(next, Math.min(100, visualRef.current + (reduced ? 100 : 1.25)));
      if (skipped) next = 100;

      const current = visualRef.current;
      const smoothed = Math.abs(next - current) < 0.04 ? next : current + (next - current) * (reduced ? 1 : 0.085);
      visualRef.current = smoothed;
      setVisualProgress(smoothed);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [actualReady, reduced, skipped]);

  async function revealMain() {
    if (revealed.current) return;
    revealed.current = true;
    setPhase("ready");
    setStatusMessage("System online");
    window.clearTimeout(maxTimer.current ?? undefined);
    const elapsed = Date.now() - startedAt.current;
    const hold = skipped ? 220 : Math.max(READY_HOLD_MS, MIN_READY_REVEAL_MS - elapsed);
    window.setTimeout(() => {
      setPhase("out");
      window.setTimeout(async () => {
        try { await invoke("show_main_window"); }
        catch (e) {
          setError(String(e));
          setPhase("error");
          revealed.current = false;
        }
      }, reduced ? 80 : EXIT_MS);
    }, Math.max(0, hold));
  }

  useEffect(() => {
    if (revealed.current) return;
    if ((actualReady || skipped) && visualProgress >= 99.4) void revealMain();
  }, [actualReady, skipped, visualProgress]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const on = async (name: string, fn: (payload: InitEvent) => void) => {
      try { unsubs.push(await listen<InitEvent>(name, (e) => fn(e.payload || {}))); } catch {}
    };

    void on("app://init-progress", (p) => {
      if (revealed.current) return;
      setPhase((prev) => (prev === "in" ? "run" : prev));
      if (typeof p.progress === "number") setActualProgress((v) => clamp(Math.max(v, p.progress!), 0, 100));
      if (p.message) setStatusMessage(p.message);
    });
    void on("app://init-complete", (p) => {
      if (typeof p.progress === "number") setActualProgress(100);
      if (p.message) setStatusMessage(p.message);
      setActualReady(true);
    });
    void on("app://init-error", (p) => {
      setError(p.error || p.message || "Startup failed");
      setPhase("error");
      setActualProgress((v) => Math.max(v, 88));
    });

    const kick = window.setTimeout(async () => {
      setPhase((prev) => (prev === "in" ? "run" : prev));
      setActualProgress((v) => Math.max(v, 8));
      try { await invoke("splash_ready"); }
      catch (e) { setError(String(e)); setPhase("error"); }
    }, reduced ? 20 : 120);

    maxTimer.current = window.setTimeout(() => {
      if (!revealed.current) setActualReady(true);
    }, MAX_WAIT_MS);

    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(maxTimer.current ?? undefined);
      unsubs.forEach((u) => u());
    };
  }, [reduced]);

  const p = visualProgress;
  const si = stageIndexFor(p);
  const stage = STAGES[si];
  const stageLocal = clamp((p - stage.at) / Math.max(1, stage.end - stage.at), 0, 1);
  const appReady = actualReady || skipped;

  return (
    <div className={`splash-root phase-${phase} ${reduced ? "reduced" : ""}`} aria-label="ORBIT IDE startup">
      <div className="card" role="status" aria-live="polite">
        <div className="surface-glow" aria-hidden />
        <div className="surface-sheen" aria-hidden />

        <header className="top">
          <div className="product-mark" aria-hidden>
            <span className="mark-orbit" />
            <span className="mark-core" />
          </div>
          <div className="wordmark">
            <div className="name">ORBIT</div>
            <div className="edition">Desktop workspace</div>
          </div>
          {!error ? (
            <button type="button" className="skip" onClick={() => setSkipped(true)} aria-label="Skip startup animation">
              Skip
            </button>
          ) : <div className="skip-spacer" />}
        </header>

        <main className="center">
          <div className={`focus ${phase === "ready" ? "focus-ready" : ""}`} aria-hidden>
            <svg viewBox="0 0 180 180" className="focus-svg">
              <defs>
                <linearGradient id="orbitStroke" x1="20" y1="24" x2="160" y2="156" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="rgba(214,234,255,0.92)" />
                  <stop offset="0.55" stopColor="rgba(150,196,255,0.72)" />
                  <stop offset="1" stopColor="rgba(255,255,255,0.24)" />
                </linearGradient>
                <radialGradient id="orbitCore" cx="50%" cy="42%" r="60%">
                  <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="1" stopColor="rgba(170,214,255,0.12)" />
                </radialGradient>
              </defs>
              <circle cx="90" cy="90" r="62" className="focus-ring focus-ring-outer" />
              <circle
                cx="90" cy="90" r="62"
                className="focus-ring focus-ring-progress"
                pathLength={100}
                style={{ strokeDashoffset: 100 - p }}
              />
              <g className="focus-orbit">
                <ellipse cx="90" cy="90" rx="44" ry="18" className="focus-ellipse" />
                <circle cx="134" cy="90" r="2.8" className="focus-node" />
              </g>
              <circle cx="90" cy="90" r="10" className="focus-core" />
            </svg>
          </div>

          <div className="copy">
            <div className="stage-kicker">Stage {si + 1} of {STAGES.length}</div>
            <h1 className="stage-title">{phase === "ready" ? "System online" : stage.label}</h1>
            <p className="stage-detail">
              {error ? "A startup component needs attention." : phase === "ready" ? "Opening your workspace." : stage.detail}
            </p>
            <div className="stage-rail" aria-hidden>
              {STAGES.map((s, i) => {
                const state = i < si ? "done" : i === si ? "active" : "pending";
                const width = i < si ? 100 : i === si ? stageLocal * 100 : 0;
                return (
                  <div key={s.id} className={`rail-segment ${state}`}>
                    <span style={{ transform: `scaleX(${width / 100})` }} />
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <footer className="bottom">
          <div className="status-row">
            <span className="status-text">{error ? "Startup issue" : statusMessage}</span>
            <span className="status-meta">{appReady && phase !== "ready" && !skipped ? "App ready" : `${Math.round(p)}%`}</span>
          </div>
          <div className="progress-track" aria-hidden>
            <div className="progress-fill" style={{ transform: `scaleX(${clamp(p, 0, 100) / 100})` }} />
          </div>
          {error ? (
            <div className="error">
              <div className="error-text">{error}</div>
              <button type="button" className="error-btn" onClick={() => { setError(null); revealed.current = false; void revealMain(); }}>Continue</button>
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><SplashApp /></React.StrictMode>
);
