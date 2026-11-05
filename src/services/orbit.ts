import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type DirEntry = {
  name: string; path: string; is_dir: boolean; is_file: boolean;
  is_hidden: boolean; size?: number | null; ext?: string | null;
};
export type GitChange = { path: string; status: string; staged: boolean };
export type GitStatus = { is_repo: boolean; branch?: string | null; changed: GitChange[] };
export type TermInfo = { id: string };

export const orbit = {
  listDir: (path: string) => invoke<DirEntry[]>("fs_list_dir", { req: { path } }),
  readFile: (path: string) => invoke<string>("fs_read_file", { path }),
  writeFile: (path: string, content: string) => invoke<void>("fs_write_file", { req: { path, content } }),
  create: (path: string, is_dir: boolean) => invoke<void>("fs_create", { req: { path, is_dir } }),
  rename: (from: string, to: string) => invoke<void>("fs_rename", { req: { from, to } }),
  remove: (path: string) => invoke<void>("fs_delete", { path }),
  gitStatus: (path: string) => invoke<GitStatus>("git_status", { path }),
  gitRun: (path: string, args: string[]) => invoke<string>("git_run", { path, args }),
  termCreate: (cwd?: string | null, cols?: number, rows?: number) => invoke<TermInfo>("terminal_create", { req: { cwd: cwd ?? null, cols, rows } }),
  termWrite: (id: string, data: string) => invoke<void>("terminal_write", { req: { id, data } }),
  termResize: (id: string, cols: number, rows: number) => invoke<void>("terminal_resize", { req: { id, cols, rows } }),
  termKill: (id: string) => invoke<void>("terminal_kill", { id }),
  onTermData: (cb: (p: { id: string; data: string }) => void): Promise<UnlistenFn> => listen("terminal://data", (e) => cb(e.payload as any)),
  onTermExit: (cb: (p: { id: string; code?: number | null }) => void): Promise<UnlistenFn> => listen("terminal://exit", (e) => cb(e.payload as any)),
};
