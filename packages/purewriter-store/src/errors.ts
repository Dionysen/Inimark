import type { StoreErrorPayload } from "./types.ts";

/** Normalize Tauri invoke / store errors into a readable string. */
export function formatStoreError(err: unknown): string {
  if (err == null) return "unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) {
      const code = typeof o.code === "string" ? o.code : null;
      return code ? `${code}: ${o.message}` : o.message;
    }
    // Tauri permission / IPC wrappers
    if (typeof o.error === "string") return o.error;
    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
}

export function isStoreErrorPayload(err: unknown): err is StoreErrorPayload {
  return (
    typeof err === "object" &&
    err != null &&
    typeof (err as StoreErrorPayload).code === "string" &&
    typeof (err as StoreErrorPayload).message === "string"
  );
}
