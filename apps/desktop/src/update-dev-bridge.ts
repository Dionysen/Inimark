import { isTauri } from "./platform/env.ts";
import type { AutoUpdateCheckReport, AutoUpdateState } from "./update/auto-update.ts";

export const UPDATE_DEV_CHECK_REQUEST = "inimark:update-dev-check-request";
export const UPDATE_DEV_CHECK_RESULT = "inimark:update-dev-check-result";

const DEV_CHECK_TIMEOUT_MS = 60_000;

export interface UpdateDevCheckRequest {
  requestId: string;
}

export interface UpdateDevCheckResult {
  requestId: string;
  report: AutoUpdateCheckReport;
  state: AutoUpdateState;
}

/** Ask the main window to run a background update check and wait for the result. */
export async function requestBackgroundUpdateCheck(): Promise<UpdateDevCheckResult | null> {
  if (!isTauri() || !import.meta.env.DEV) return null;

  const { emit, listen } = await import("@tauri-apps/api/event");
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    let unlisten: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, DEV_CHECK_TIMEOUT_MS);

    function cleanup(): void {
      window.clearTimeout(timeout);
      unlisten?.();
    }

    void listen<UpdateDevCheckResult>(UPDATE_DEV_CHECK_RESULT, (event) => {
      if (event.payload.requestId !== requestId) return;
      cleanup();
      resolve(event.payload);
    }).then((fn) => {
      unlisten = fn;
      void emit(UPDATE_DEV_CHECK_REQUEST, { requestId } satisfies UpdateDevCheckRequest);
    });
  });
}

/** Main window handler for dev-triggered background update checks. */
export function mountUpdateDevCheckHandler(
  onCheck: () => Promise<AutoUpdateCheckReport>,
  getState: () => AutoUpdateState,
): () => void {
  if (!isTauri() || !import.meta.env.DEV) return () => {};

  let disposed = false;
  let unlisten: (() => void) | undefined;

  void (async () => {
    const { listen, emit } = await import("@tauri-apps/api/event");
    unlisten = await listen<UpdateDevCheckRequest>(UPDATE_DEV_CHECK_REQUEST, async (event) => {
      if (disposed) return;

      const { requestId } = event.payload;
      const report = await onCheck();
      await emit(UPDATE_DEV_CHECK_RESULT, {
        requestId,
        report,
        state: getState(),
      } satisfies UpdateDevCheckResult);
    });
  })();

  return () => {
    disposed = true;
    unlisten?.();
  };
}
