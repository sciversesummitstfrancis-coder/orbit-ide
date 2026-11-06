import { useState, type ReactNode } from "react";
export default function Collapsible({ title, defaultOpen = false, right, children }: { title: string; defaultOpen?: boolean; right?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`collapse ${open ? "open" : ""}`}>
      <button type="button" className="collapse-head" onClick={() => setOpen((v) => !v)}>
        <span className="collapse-chev">{open ? "▾" : "▸"}</span>
        <span className="collapse-title">{title}</span>
        {right ? <span className="collapse-right" onClick={(e) => e.stopPropagation()}>{right}</span> : null}
      </button>
      {open ? <div className="collapse-body">{children}</div> : null}
    </section>
  );
}
