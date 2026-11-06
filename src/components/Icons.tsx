import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({ width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, ...p });

export const OrbitMark = ({ size = 18, ...p }: P & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="3.2" fill="currentColor" opacity="0.95" />
    <ellipse cx="12" cy="12" rx="9.2" ry="4.2" stroke="currentColor" strokeWidth="1.6" opacity="0.55" transform="rotate(-22 12 12)" />
    <circle cx="19.2" cy="8.2" r="1.25" fill="currentColor" />
  </svg>
);
export const ExplorerIcon = (p: P) => <svg {...base(p)}><rect x="3.5" y="4.5" width="7" height="15" rx="1.5"/><rect x="10.5" y="4.5" width="10" height="6" rx="1.5"/><rect x="10.5" y="13.5" width="10" height="6" rx="1.5"/></svg>;
export const SearchIcon = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>;
export const GitIcon = (p: P) => <svg {...base(p)}><circle cx="7" cy="6.5" r="2"/><circle cx="17" cy="6.5" r="2"/><circle cx="7" cy="17.5" r="2"/><path d="M7 8.5v7M7 10.5c0 3 10 1.5 10 5"/></svg>;
export const ExtensionsIcon = (p: P) => <svg {...base(p)}><path d="M13.5 3.5h5a2 2 0 012 2v5h-4a2 2 0 100 4h4v3a2 2 0 01-2 2h-15v-5h4a2 2 0 100-4h-4v-7h5a2 2 0 104 0z"/></svg>;
export const DebugIcon = (p: P) => <svg {...base(p)}><path d="M8 8a4 4 0 118 0v2a5 5 0 01-10 0V8z"/><path d="M9 8V6.5M15 8V6.5M4 11h4m8 0h4M5 7l3 2m11-2l-3 2M5 16l3-2m11 2l-3-2M12 12v8"/></svg>;
export const SettingsIcon = (p: P) => <svg {...base(p)}><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"/><path d="M19.4 15a1 1 0 00.2 1.1l.1.1a1.2 1.2 0 01-1.7 1.7l-.1-.1a1 1 0 00-1.1-.2 1 1 0 00-.6.9V19a1.2 1.2 0 01-2.4 0v-.1a1 1 0 00-.7-.9 1 1 0 00-1.1.2l-.1.1a1.2 1.2 0 11-1.7-1.7l.1-.1a1 1 0 00.2-1.1 1 1 0 00-.9-.6H9a1.2 1.2 0 010-2.4h.1a1 1 0 00.9-.7 1 1 0 00-.2-1.1l-.1-.1a1.2 1.2 0 111.7-1.7l.1.1a1 1 0 001.1.2h.1a1 1 0 00.6-.9V5a1.2 1.2 0 012.4 0v.1a1 1 0 00.6.9 1 1 0 001.1-.2l.1-.1a1.2 1.2 0 111.7 1.7l-.1.1a1 1 0 00-.2 1.1v.1a1 1 0 00.9.6H19a1.2 1.2 0 010 2.4h-.1a1 1 0 00-.9.6z"/></svg>;
export const SaveIcon = (p: P) => <svg {...base(p)}><path d="M5 4.5h11l3.5 3.5v11.5H5z"/><path d="M8 4.5v5.5h8V4.5M8 19.5v-5h8v5"/></svg>;
export const RefreshIcon = (p: P) => <svg {...base(p)}><path d="M20 12a8 8 0 10-2.3 5.7M20 8v4h-4"/></svg>;
export const FolderIcon = (p: P) => <svg {...base(p)}><path d="M3.5 6.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/></svg>;
export const ChevronIcon = ({ open, ...p }: P & { open?: boolean }) => <svg {...base(p)} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 120ms ease", ...(p.style || {}) }}><path d="M9 6l6 6-6 6"/></svg>;
export const FileIcon = (p: P) => <svg {...base(p)}><path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5v4.5h4.5"/></svg>;
