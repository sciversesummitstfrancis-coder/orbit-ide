import { invoke } from "@tauri-apps/api/core";

export type CapsuleMeta = { id: string; name: string; created_at: number; updated_at: number; workspace?: string | null };
export type Capsule = CapsuleMeta & { data: any };

export const capsulesApi = {
  save: (payload: { id?: string; name: string; workspace?: string | null; data: any }) => invoke<CapsuleMeta>("capsule_save", { id: payload.id ?? null, name: payload.name, workspace: payload.workspace ?? null, data: payload.data }),
  list: (workspace?: string | null, limit?: number) => invoke<CapsuleMeta[]>("capsule_list", { workspace: workspace ?? null, limit: limit ?? null }),
  get: (id: string) => invoke<Capsule>("capsule_get", { id }),
  delete: (id: string) => invoke<void>("capsule_delete", { id }),
};
