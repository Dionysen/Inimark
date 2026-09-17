import { createShortcutGuard } from "@dionysen/shortcut-kit";

/** Inimark uses markdown + CodeMirror editor hosts. */
export const inimarkShortcutGuard = createShortcutGuard({
  editorSelector: [
    ".inimark-editor-host",
    ".ProseMirror",
    ".cm-editor",
    ".cm-content",
  ].join(", "),
  recordingSelector: ".inimark-settings-shortcut-capture.is-recording",
});

export const {
  isShortcutRecordingActive,
  isInMarkdownEditor,
  isEditableTarget,
  isSelectableTarget,
  hasCopyableTextSelection,
  isTextEditingShortcut,
  isSelectionClipboardShortcut,
  isBrowserShortcut,
  shouldBlockNativeShortcut,
  blockNativeShortcut,
  installNativeShortcutGuard,
} = inimarkShortcutGuard;
