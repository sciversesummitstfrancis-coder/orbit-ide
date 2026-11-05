import { create } from "zustand";
import type { DirEntry, GitStatus } from "../services/orbit";

export type OpenFile = { path: string; name: string; content: string; saved: string; language?: string };

type State = {
  root: string | null;
  entries: DirEntry[];
  git: GitStatus | null;
  files: OpenFile[];
  activePath: string | null;
  setRoot: (root: string | null) => void;
  setEntries: (entries: DirEntry[]) => void;
  setGit: (git: GitStatus | null) => void;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActive: (path: string | null) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string) => void;
};

export const useWorkspace = create<State>((set) => ({
  root: null, entries: [], git: null, files: [], activePath: null,
  setRoot: (root) => set({ root }),
  setEntries: (entries) => set({ entries }),
  setGit: (git) => set({ git }),
  openFile: (file) => set((s) => {
    const exists = s.files.find((f) => f.path === file.path);
    return { files: exists ? s.files : [...s.files, file], activePath: file.path };
  }),
  closeFile: (path) => set((s) => {
    const files = s.files.filter((f) => f.path !== path);
    const activePath = s.activePath === path ? (files[files.length - 1]?.path ?? null) : s.activePath;
    return { files, activePath };
  }),
  setActive: (activePath) => set({ activePath }),
  updateContent: (path, content) => set((s) => ({ files: s.files.map((f) => f.path === path ? { ...f, content } : f) })),
  markSaved: (path) => set((s) => ({ files: s.files.map((f) => f.path === path ? { ...f, saved: f.content } : f) })),
}));
