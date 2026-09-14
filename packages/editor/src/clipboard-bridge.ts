/** Host injects OS-level clipboard helpers (e.g. Tauri) to avoid WebView prompts. */

export interface ClipboardBridge {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

let bridge: ClipboardBridge | null = null;

export function setClipboardBridge(next: ClipboardBridge | null): void {
  bridge = next;
}

export function getClipboardBridge(): ClipboardBridge | null {
  return bridge;
}

/** Write plain text to the clipboard (host bridge when available). */
export async function writeTextToClipboard(text: string): Promise<void> {
  const host = getClipboardBridge();
  if (host) {
    await host.writeText(text);
    return;
  }
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  });
}
