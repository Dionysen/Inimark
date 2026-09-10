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
