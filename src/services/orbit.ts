import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type DirEntry = { name: string; path: string; is_dir: boolean; is_file: boolean; is_hidden: boolean; size?: number | null; ext?: string | null };
export type GitChange = { path: string; status: string; staged: boolean };
export type GitStatus = { is_repo: boolean; branch?: string | null; changed: GitChange[] };
export type TermInfo = { id: string };
export type LspServerConfig = { id: string; language: string; command: string; args: string[]; enabled: boolean };
export type RecentWorkspace = { path: string; name: string; opened_at: number };
export type SessionState = { root?: string | null; active_path?: string | null; open_files: string[] };
export type ExtensionManifest = { id: string; name: string; version: string; description: string; permissions: string[]; contributes: unknown };
export type ExtensionInfo = { manifest: ExtensionManifest; path: string; enabled: boolean; trusted: boolean };
export type AiConfig = { enabled: boolean; provider: string; endpoint: string; model: string };
export type AiTask = "explain_code" | "explain_error" | "suggest_refactor" | "draft_commit" | "generate_docs" | "custom";
export type AiContext = { task?: AiTask; prompt?: string; active_path?: string | null; active_content?: string | null; selection?: string | null; git_summary?: string | null; git_diff?: string | null; diagnostics?: string | null; error_text?: string | null };
export type AiChunk = { id: string; chunk: string; done: boolean; error?: string | null };

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
  lspList: () => invoke<LspServerConfig[]>("lsp_list"),
  lspStart: (config: LspServerConfig) => invoke<string>("lsp_start", { config }),
  lspSend: (server_id: string, message: unknown) => invoke<void>("lsp_send", { serverId: server_id, message }),
  lspStop: (server_id: string) => invoke<void>("lsp_stop", { serverId: server_id }),
  onLspMessage: (cb: (p: { server_id: string; message: unknown }) => void): Promise<UnlistenFn> => listen("lsp://message", (e) => cb(e.payload as any)),
  onLspExit: (cb: (p: { server_id?: string }) => void): Promise<UnlistenFn> => listen("lsp://exit", (e) => cb(e.payload as any)),
  onLspStderr: (cb: (p: { server_id: string; line: string }) => void): Promise<UnlistenFn> => listen("lsp://stderr", (e) => cb(e.payload as any)),
};

export const workspaceApi = {
  addRecent: (path: string) => invoke<void>("workspace_add_recent", { path }),
  listRecent: () => invoke<RecentWorkspace[]>("workspace_list_recent"),
  saveSession: (session: SessionState) => invoke<void>("session_save", { session }),
  restoreSession: () => invoke<SessionState>("session_restore"),
};

export const m9Api = {
  extensionsList: () => invoke<ExtensionInfo[]>("extensions_list"),
  extensionsSetEnabled: (id: string, enabled: boolean) => invoke<void>("extensions_set_enabled", { id, enabled }),
  extensionsScaffold: () => invoke<any>("extensions_scaffold"),
  aiGetConfig: () => invoke<AiConfig>("ai_get_config"),
  aiSetConfig: (config: AiConfig) => invoke<void>("ai_set_config", { config }),
  aiListModels: () => invoke<string[]>("ai_list_models"),
  aiCheckRuntime: () => invoke<any>("ai_check_runtime"),
  aiCancel: (id: string) => invoke<void>("ai_cancel", { id }),
  aiComplete: (prompt: string) => invoke<any>("ai_complete", { prompt }),
  aiRunTask: (ctx: AiContext) => invoke<any>("ai_run_task", { ctx }),
  aiStreamTask: (ctx: AiContext) => invoke<string>("ai_stream_task", { ctx }),
  onAiChunk: (cb: (p: AiChunk) => void): Promise<UnlistenFn> => listen("ai://chunk", (e) => cb(e.payload as any)),
};
