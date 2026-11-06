import { useState } from "react";
import { orbit, type DirEntry } from "../services/orbit";
import { useWorkspace } from "../store/workspace";
import { ChevronIcon, FileIcon, FolderIcon } from "./Icons";

function extBadge(e: DirEntry) {
  const ext = (e.ext || "").toUpperCase();
  if (["TS", "TSX", "JS", "JSX", "MJS", "CJS"].includes(ext)) return { t: ext.slice(0, 2), cls: "ts" };
  if (ext === "RS") return { t: "RS", cls: "rs" };
  if (ext === "JSON") return { t: "{}", cls: "json" };
  if (["MD", "MDX"].includes(ext)) return { t: "MD", cls: "md" };
  if (["CSS", "SCSS"].includes(ext)) return { t: "#", cls: "json" };
  if (["HTML", "XML", "SVG"].includes(ext)) return { t: "<>", cls: "md" };
  if (["PY"].includes(ext)) return { t: "PY", cls: "ts" };
  return null;
}

function Node({ entry, depth, onOpen }: { entry: DirEntry; depth: number; onOpen: (p: string, n: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kids, setKids] = useState<DirEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toggle = async () => {
    if (!entry.is_dir) return onOpen(entry.path, entry.name);
    const next = !open; setOpen(next); setErr(null);
    if (next && !kids) {
      try { setKids(await orbit.listDir(entry.path)); }
      catch (e) { setErr(String(e)); }
    }
  };
  const badge = !entry.is_dir ? extBadge(entry) : null;
  return (
    <div>
      <button type="button" className="tree-row" style={{ paddingLeft: 6 + depth * 12 }} onClick={toggle} title={entry.path}>
        <span className="tree-chevron">{entry.is_dir ? <ChevronIcon open={open} width={14} height={14} /> : <span style={{ width: 14, display: "inline-block" }} />}</span>
        <span className={`tree-icon ${entry.is_dir ? "dir" : ""}`}>{entry.is_dir ? <FolderIcon width={15} height={15} /> : <FileIcon width={15} height={15} />}</span>
        <span className="tree-name">{entry.name}</span>
        {badge ? <span className={`tree-badge ${badge.cls}`}>{badge.t}</span> : null}
      </button>
      {err ? <div style={{ paddingLeft: 34 + depth * 12, color: "var(--danger)", fontSize: 11 }}>{err}</div> : null}
      {open && kids?.map((k) => <Node key={k.path} entry={k} depth={depth + 1} onOpen={onOpen} />)}
    </div>
  );
}

export default function Explorer({ onOpenFolder }: { onOpenFolder: () => void }) {
  const { root, entries, openFile } = useWorkspace();
  const onOpen = async (path: string, name: string) => {
    try { const content = await orbit.readFile(path); openFile({ path, name, content, saved: content }); } catch (e) { console.error(e); }
  };
  if (!root) return (
    <div className="empty-state">
      <p>No folder open.</p>
      <button className="btn primary" type="button" onClick={onOpenFolder}>Open Folder</button>
      <div className="section-label">GETTING STARTED</div>
      <p style={{ fontSize: 12 }}>Open a local project to browse files, edit with Monaco, and inspect Git status.</p>
    </div>
  );
  return (
    <div className="tree">
      <div className="tree-root" title={root}>{root.split(/[/\\]/).filter(Boolean).pop() || root}</div>
      {entries.map((e) => <Node key={e.path} entry={e} depth={0} onOpen={onOpen} />)}
    </div>
  );
}
