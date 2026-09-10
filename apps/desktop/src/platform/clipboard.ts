import { setClipboardBridge } from "@inimark/editor";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

import { isTauri } from "./env.ts";

/** Wire OS clipboard into the editor so menu paste avoids WebView permission prompts. */
export function installClipboardBridge(): () => void {
  if (!isTauri()) return () => {};
  setClipboardBridge({
    readText: () => readText(),
    writeText: (text) => writeText(text),
  });
  return () => setClipboardBridge(null);
}
