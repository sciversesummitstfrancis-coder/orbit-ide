import { invoke } from "@tauri-apps/api/core";

export type DirEntry = {
  name: string; path: string; is_dir: boolean; is_file: boolean;
  is_hidden: boolean; size?: number | null; ext?: string | null;
};
export type GitChange = { path: string; status: string; staged: boolean };
export type GitStatus = { is_repo: boolean; branch?: string | null; changed: GitChange[] };

export const orbit = {
  listDir: (path: string) => invoke<DirEntry[]>("fs_list_dir", { req: { path } }),
  readFile: (path: string) => invoke<string>("fs_read_file", { path }),
  writeFile: (path: string, content: string) => invoke<void>("fs_write_file", { req: { path, content } }),
  create: (path: string, is_dir: boolean) => invoke<void>("fs_create", { req: { path, is_dir } }),
  rename: (from: string, to: string) => invoke<void>("fs_rename", { req: { from, to } }),
  remove: (path: string) => invoke<void>("fs_delete", { path }),
  gitStatus: (path: string) => invoke<GitStatus>("git_status", { path }),
  gitRun: (path: string, args: string[]) => invoke<string>("git_run", { path, args }),
};
