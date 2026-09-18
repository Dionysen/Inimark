export type UpdateErrorKind = "network" | "other";

const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "network error",
  "network request failed",
  "err_network",
  "econnrefused",
  "enotfound",
  "etimedout",
  "econnreset",
  "enetunreach",
  "connection refused",
  "connection reset",
  "connection failed",
  "connection aborted",
  "connection timed out",
  "timed out",
  "timeout",
  "unable to connect",
  "could not connect",
  "no such host",
  "name not resolved",
  "dns",
  "resolve host",
  "offline",
  "no internet",
  "unreachable",
  "socket",
  "fetch failed",
  "network changed",
  "ns_error",
  "http status 408",
  "http status 502",
  "http status 503",
  "http status 504",
  "http status 522",
  "http status 524",
];

function errorMessage(error: unknown): string {
  if (error == null) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? "";
  } catch {
    return String(error);
  }
}

const TRANSIENT_HTTP_STATUS = /\b(408|502|503|504|522|524)\b/;

/** Classify updater failures so the About page can show an actionable message. */
export function classifyUpdateError(error: unknown): UpdateErrorKind {
  const text = errorMessage(error).trim().toLowerCase();
  if (!text) return "other";
  if (TRANSIENT_HTTP_STATUS.test(text)) return "network";
  if (NETWORK_ERROR_PATTERNS.some((pattern) => text.includes(pattern))) {
    return "network";
  }
  return "other";
}

export function formatProgressPercent(
  downloaded: number,
  contentLength: number | null,
): string {
  if (!contentLength || contentLength <= 0) {
    return downloaded > 0 ? "…" : "";
  }
  const pct = Math.min(100, Math.round((downloaded / contentLength) * 100));
  return `${pct}%`;
}
