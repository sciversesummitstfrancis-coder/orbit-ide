import { useEffect, useRef, useState } from "react";

export default function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 420);
    const t2 = setTimeout(() => setPhase("out"), 1950);
    const t3 = setTimeout(onDone, 2450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { setPhase("out"); setTimeout(onDone, 350); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  function onMove(e: React.MouseEvent) {
    const el = wrapRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    setTilt({ x: y * -10, y: x * 12 });
  }

  return (
    <div
      ref={wrapRef}
      className={`splash splash-${phase}`}
      role="dialog"
      aria-label="ORBIT IDE loading"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={() => { setPhase("out"); setTimeout(onDone, 320); }}
    >
      <div className="splash-bg" />
      <div className="splash-stage" style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        <div className="splash-atom" aria-hidden>
          <div className="nucleus"><span /></div>
          <div className="orbit orbit-a"><span className="electron" /></div>
          <div className="orbit orbit-b"><span className="electron" /></div>
          <div className="orbit orbit-c"><span className="electron" /></div>
          <div className="orbit orbit-d"><span className="electron electron-trail" /></div>
        </div>
        <div className="splash-brand">
          <div className="splash-mark">ORBIT IDE</div>
          <div className="splash-tag">Your code. Your environment. Your orbit.</div>
          <div className="splash-loader"><span /></div>
          <div className="splash-hint">Click or press Enter to continue</div>
        </div>
      </div>
    </div>
  );
}
