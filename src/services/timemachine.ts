import { invoke } from "@tauri-apps/api/core";

export type SnapshotMeta = { id: number; ts: number; path: string; workspace?: string | null; kind: string; bytes: number };
export type Snapshot = SnapshotMeta & { content: string };

export const tmApi = {
  list: (opts?: { path?: string; workspace?: string; limit?: number }) => invoke<SnapshotMeta[]>("tm_list", { path: opts?.path ?? null, workspace: opts?.workspace ?? null, limit: opts?.limit ?? null }),
  get: (id: number) => invoke<Snapshot>("tm_get", { id }),
  capture: (path: string, content: string, opts?: { workspace?: string; kind?: string }) => invoke<void>("tm_capture", { path, workspace: opts?.workspace ?? null, kind: opts?.kind ?? null, content }),
  latestDirty: (workspace?: string | null) => invoke<SnapshotMeta[]>("tm_latest_dirty", { workspace: workspace ?? null }),
  delete: (opts: { id?: number; path?: string } | null) => invoke<void>("tm_delete", { id: opts?.id ?? null, path: opts?.path ?? null }),
};
