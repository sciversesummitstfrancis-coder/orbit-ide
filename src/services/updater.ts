import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { invoke } from "@tauri-apps/api/core";

export type UpdaterConfig = { autoCheck: boolean; lastCheckedAt?: number | null };
const KEY = "updates.config";

export async function getUpdaterConfig(): Promise<UpdaterConfig> {
  try { const v = await invoke<any>("settings_get", { key: KEY }); return { autoCheck: !!v?.autoCheck, lastCheckedAt: typeof v?.lastCheckedAt === "number" ? v.lastCheckedAt : null }; }
  catch { return { autoCheck: false, lastCheckedAt: null }; }
}
export async function setUpdaterConfig(cfg: UpdaterConfig) { await invoke("settings_set", { key: KEY, value: cfg }).catch(() => {}); }
export async function checkForUpdate(opts?: { auto?: boolean }) {
  const cfg = await getUpdaterConfig();
  if (opts?.auto && !cfg.autoCheck) return { status: "disabled" as const };
  try {
    const update = await check();
    await setUpdaterConfig({ ...cfg, lastCheckedAt: Date.now() });
    if (!update) return { status: "up_to_date" as const };
    const msg = `ORBIT IDE ${update.version} is available.${update.date ? `\n\nReleased: ${update.date}` : ""}${update.body ? `\n\n${update.body}` : ""}\n\nDownload and install now? The app will restart.`;
    if (!window.confirm(msg)) return { status: "available" as const, version: update.version };
    await update.downloadAndInstall();
    await relaunch();
    return { status: "installing" as const, version: update.version };
  } catch (e) {
    await setUpdaterConfig({ ...cfg, lastCheckedAt: Date.now() }).catch(() => {});
    const msg = String(e || "update check failed");
    if (/updater|endpoint|pubkey|latest\.json|signature|404|not configured|disabled/i.test(msg)) return { status: "not_configured" as const, message: msg };
    return { status: "error" as const, message: msg };
  }
}
