import { useState } from "react";
import { orbit, type DirEntry } from "../services/orbit";
import { useWorkspace } from "../store/workspace";

function icon(e: DirEntry) {
  if (e.is_dir) return { t: "▸", cls: "dir" };
  const ext = e.ext || "";
  if (["ts", "tsx"].includes(ext)) return { t: "TS", cls: "ts" };
  if (["js", "jsx", "mjs", "cjs"].includes(ext)) return { t: "JS", cls: "ts" };
  if (ext === "rs") return { t: "RS", cls: "rs" };
  if (ext === "json") return { t: "{}", cls: "json" };
  if (["md", "mdx"].includes(ext)) return { t: "MD", cls: "md" };
  if (["css", "scss"].includes(ext)) return { t: "#", cls: "json" };
  if (["html", "xml", "svg"].includes(ext)) return { t: "<>", cls: "md" };
  return { t: "·", cls: "" };
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
  const i = icon(entry);
  return (
    <div>
      <button type="button" className="tree-row" style={{ paddingLeft: 8 + depth * 12 }} onClick={toggle} title={entry.path}>
        <span className={`tree-glyph ${i.cls}`}>{entry.is_dir ? (open ? "▾" : "▸") : i.t}</span>
        <span className="tree-name">{entry.name}</span>
      </button>
      {err ? <div style={{ paddingLeft: 28 + depth * 12, color: "var(--danger)", fontSize: 11 }}>{err}</div> : null}
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
