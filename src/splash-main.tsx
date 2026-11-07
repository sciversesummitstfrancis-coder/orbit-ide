import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./splash.css";

type InitEvent = { step?: string; message?: string; progress?: number; error?: string };

const MIN_VISIBLE_MS = 1400;
const MAX_WAIT_MS = 12000;
const READY_HOLD_MS = 420;
const EXIT_MS = 460;

const DEFAULT_STEPS = [
  "Initializing environment",
  "Preparing workspace services",
  "Loading resources",
  "Almost ready",
];

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function SplashApp() {
  const [progress, setProgress] = useState(8);
  const [message, setMessage] = useState(DEFAULT_STEPS[0]);
  const [phase, setPhase] = useState<"in" | "run" | "ready" | "out" | "error">("in");
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const readyTimer = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);
  const completed = useRef(false);
  const reduced = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false, []);

  async function revealMain() {
    if (completed.current) return;
    completed.current = true;
    setProgress(100);
    setMessage("Ready");
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
      if (p.message) setMessage(p.message);
    });
    void on("app://init-complete", (p) => {
      if (typeof p.progress === "number") setProgress((v) => Math.max(v, p.progress!));
      if (p.message) setMessage(p.message);
      void revealMain();
    });
    void on("app://init-error", (p) => {
      setError(p.error || p.message || "Startup failed");
      setPhase("error");
      setProgress((v) => Math.max(v, 92));
    });

    const kick = window.setTimeout(async () => {
      setPhase((ph) => ph === "in" ? "run" : ph);
      setProgress((v) => Math.max(v, 18));
      setMessage(DEFAULT_STEPS[1]);
      try { await invoke("splash_ready"); } catch (e) { setError(String(e)); setPhase("error"); }
    }, reduced ? 20 : 120);

    maxTimer.current = window.setTimeout(() => {
      if (!completed.current && phase !== "error") void revealMain();
    }, MAX_WAIT_MS);

    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(maxTimer.current ?? undefined);
      window.clearTimeout(readyTimer.current ?? undefined);
      unsubs.forEach((u) => u());
      void current; // keep handle alive for capability context
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function continueAnyway() {
    setError(null);
    await revealMain();
  }

  return (
    <div className={`splash-root phase-${phase} ${reduced ? "reduced" : ""}`} aria-label="ORBIT IDE startup">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="grain" />
      <div className="card" role="status" aria-live="polite">
        <div className="card-glow" />
        <div className="orbit-mark" aria-hidden>
          <div className="ring ring-1"><span /></div>
          <div className="ring ring-2"><span /></div>
          <div className="nucleus" />
          <div className="sweep" />
        </div>
        <div className="brand">
          <div className="brand-name">ORBIT IDE</div>
          <div className="brand-sub">Preparing your native workspace</div>
        </div>
        <div className="status-row">
          <span className="status-text">{error ? "Startup issue" : message}</span>
          <span className="status-pct">{Math.round(progress)}%</span>
        </div>
        <div className="progress" aria-hidden>
          <div className="progress-fill" style={{ transform: `scaleX(${clamp(progress, 0, 100) / 100})` }} />
        </div>
        {error ? (
          <div className="error">
            <div className="error-text">{error}</div>
            <button type="button" className="error-btn" onClick={() => void continueAnyway()}>Continue</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><SplashApp /></React.StrictMode>
);
