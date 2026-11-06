import { invoke } from "@tauri-apps/api/core";

export const missionApi = { timeline: (workspace?: string | null, limit?: number) => invoke<any>("mission_timeline", { query: { workspace: workspace ?? null, limit: limit ?? null } }) };
export const trustApi = { scan: (req: { workspace?: string | null; active_path?: string | null; active_content?: string | null }) => invoke<any>("trust_scan", { req }) };
export const atlasApi = {
  index: (workspace: string, query?: string, limit?: number) => invoke<any>("atlas_index", { req: { workspace, query: query ?? null, limit: limit ?? null } }),
  impact: (workspace: string, query?: string) => invoke<any>("atlas_impact", { req: { workspace, query: query ?? null, limit: null } }),
};
export const replayApi = { plan: (capsule_id?: string | null, workspace?: string | null) => invoke<any>("replay_plan", { req: { capsule_id: capsule_id ?? null, workspace: workspace ?? null } }) };
export const hudApi = { metrics: (workspace?: string | null) => invoke<any>("hud_metrics", { workspace: workspace ?? null }) };
