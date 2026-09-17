import { createShortcutGuard } from "@dionysen/shortcut-kit";

export const vellumShortcutGuard = createShortcutGuard({
  editorSelector: ".vellum-plaintext-editor, textarea, [contenteditable='true']",
  recordingSelector: ".inimark-settings-shortcut-capture.is-recording",
});

export const {
  isShortcutRecordingActive,
  installNativeShortcutGuard,
} = vellumShortcutGuard;
