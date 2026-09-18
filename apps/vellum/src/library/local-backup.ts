/** Local `.pwb` snapshot interval. */
export const LOCAL_BACKUP_INTERVAL_MS = 5 * 60 * 1000;

export interface IntervalTimer {
  set(callback: () => void, ms: number): number;
  clear(id: number): void;
}

const defaultTimer: IntervalTimer = {
  set: (callback, ms) => window.setInterval(callback, ms) as unknown as number,
  clear: (id) => window.clearInterval(id),
};

/**
 * Calls `backup` on a fixed interval.
 * A tick that starts while the previous backup is still running is skipped.
 */
export function startPeriodicBackup(
  backup: () => Promise<void>,
  intervalMs: number = LOCAL_BACKUP_INTERVAL_MS,
  timer: IntervalTimer = defaultTimer,
): () => void {
  let stopped = false;
  let running = false;
  const id = timer.set(() => {
    if (stopped || running) return;
    running = true;
    void backup()
      .catch(() => {})
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  return () => {
    stopped = true;
    timer.clear(id);
  };
}

/** Export the open library to `App/Backups/vellum-<ms>.pwb`. No-op outside the desktop app. */
export async function writeLocalPwbBackup(): Promise<void> {
  const { isTauri } = await import("@dionysen/shell");
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("pw_local_pwb_backup");
}
