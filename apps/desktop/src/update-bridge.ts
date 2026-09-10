import { isTauri } from "./platform/env.ts";

export const UPDATE_PREFLIGHT_REQUEST = "inimark:update-preflight-request";
export const UPDATE_PREFLIGHT_RESULT = "inimark:update-preflight-result";

export interface UpdatePreflightRequest {
  requestId: string;
}

export interface UpdatePreflightResult {
  requestId: string;
  ok: boolean;
}

const PREFLIGHT_TIMEOUT_MS = 120_000;

/** Ask the main window to save or discard unsaved editor changes before updating. */
export async function requestUpdatePreflight(): Promise<boolean> {
  if (!isTauri()) return true;

  const { emit, listen } = await import("@tauri-apps/api/event");
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    let unlisten: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, PREFLIGHT_TIMEOUT_MS);

    function cleanup(): void {
      window.clearTimeout(timeout);
      unlisten?.();
    }

    void listen<UpdatePreflightResult>(UPDATE_PREFLIGHT_RESULT, (event) => {
      if (event.payload.requestId !== requestId) return;
      cleanup();
      resolve(event.payload.ok);
    }).then((fn) => {
      unlisten = fn;
      void emit(UPDATE_PREFLIGHT_REQUEST, { requestId } satisfies UpdatePreflightRequest);
    });
  });
}

export interface UpdatePreflightHandlerOptions {
  /** Returns whether the main editor has unsaved changes. */
  isDirty: () => boolean;
  /** Prompt to save/discard; resolves true when safe to continue updating. */
  confirmAndSave: () => Promise<boolean>;
}

/** Main window handler — focuses the editor and runs the unsaved-changes flow. */
export function mountUpdatePreflightHandler(
  options: UpdatePreflightHandlerOptions,
): () => void {
  if (!isTauri()) return () => {};

  let disposed = false;
  let unlisten: (() => void) | undefined;

  void (async () => {
    const { listen, emit } = await import("@tauri-apps/api/event");
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

    unlisten = await listen<UpdatePreflightRequest>(UPDATE_PREFLIGHT_REQUEST, async (event) => {
      if (disposed) return;

      const { requestId } = event.payload;
      const main = await WebviewWindow.getByLabel("main");
      await main?.setFocus();

      let ok = true;
      if (options.isDirty()) {
        ok = await options.confirmAndSave();
      }

      await emit(UPDATE_PREFLIGHT_RESULT, { requestId, ok } satisfies UpdatePreflightResult);
    });
  })();

  return () => {
    disposed = true;
    unlisten?.();
  };
}
