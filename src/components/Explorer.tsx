import { useState } from "react";
import { orbit, type DirEntry } from "../services/orbit";
import { useWorkspace } from "../store/workspace";

function icon(e: DirEntry) {
  if (e.is_dir) return "▸";
  const ext = e.ext || "";
  if (["ts", "tsx"].includes(ext)) return "TS";
  if (["js", "jsx"].includes(ext)) return "JS";
  if (ext === "rs") return "RS";
  if (["json"].includes(ext)) return "{}";
  if (["md"].includes(ext)) return "MD";
  return "·";
}

function Node({ entry, depth, onOpen }: { entry: DirEntry; depth: number; onOpen: (p: string, n: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kids, setKids] = useState<DirEntry[] | null>(null);
  const toggle = async () => {
    if (!entry.is_dir) return onOpen(entry.path, entry.name);
    const next = !open; setOpen(next);
    if (next && !kids) try { setKids(await orbit.listDir(entry.path)); } catch {}
  };
  return (
    <div>
      <button type="button" className="tree-row" style={{ paddingLeft: 8 + depth * 12 }} onClick={toggle} title={entry.path}>
        <span className="tree-glyph">{icon(entry)}</span>
        <span className="tree-name">{entry.name}</span>
      </button>
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
    <div><div>No folder open.</div><div style={{ marginTop: 10 }}><button className="btn primary" type="button" onClick={onOpenFolder}>Open Folder</button></div></div>
  );
  return <div className="tree">{entries.map((e) => <Node key={e.path} entry={e} depth={0} onOpen={onOpen} />)}</div>;
}
