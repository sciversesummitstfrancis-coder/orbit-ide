import { invoke } from "@tauri-apps/api/core";

export type Receipt = {
  id: number; ts: number; category: string; action: string; summary: string;
  detail?: unknown; status: string; workspace?: string | null; duration_ms?: number | null;
};
export type ReceiptsQuery = { limit?: number; category?: string; search?: string; workspace?: string };

export const receiptsApi = {
  list: (query?: ReceiptsQuery) => invoke<Receipt[]>("receipts_list", { query: query ?? null }),
  clear: () => invoke<void>("receipts_clear"),
  summary: () => invoke<unknown>("receipts_summary"),
};
