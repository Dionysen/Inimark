export interface ShortcutGuardOptions {
  /** CSS selector for editor hosts where browser shortcuts must stay available. */
  editorSelector?: string;
  /**
   * Read-only selectable surfaces (e.g. AI chat bubbles) where copy / select-all
   * must reach the WebView even though the target is not a text field.
   */
  selectableSelector?: string;
  /** Selector for the shortcut-recording capture field. */
  recordingSelector?: string;
}

const DEFAULT_EDITOR_SELECTOR = [
  ".inimark-editor-host",
  ".ProseMirror",
  ".cm-editor",
  ".cm-content",
].join(", ");

/** Default AI / preview surfaces that allow mouse selection + copy. */
const DEFAULT_SELECTABLE_SELECTOR = [
  ".inimark-ai-bubble",
  ".inimark-ai-tool-body",
  ".inimark-ai-thinking-body",
].join(", ");

const DEFAULT_RECORDING_SELECTOR =
  ".inimark-settings-shortcut-capture.is-recording";

const TEXT_INPUT_SELECTOR = [
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="image"]):not([type="hidden"])',
  "textarea",
  "select",
].join(", ");

function elementFromTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

export function createShortcutGuard(options: ShortcutGuardOptions = {}) {
  const editorSelector = options.editorSelector ?? DEFAULT_EDITOR_SELECTOR;
  const selectableSelector =
    options.selectableSelector ?? DEFAULT_SELECTABLE_SELECTOR;
  const recordingSelector =
    options.recordingSelector ?? DEFAULT_RECORDING_SELECTOR;

  function isShortcutRecordingActive(doc: Document = document): boolean {
    const active = doc.activeElement;
    return Boolean(active?.closest(recordingSelector));
  }

  function isInEditor(target: EventTarget | null): boolean {
    const el = elementFromTarget(target);
    return Boolean(el?.closest(editorSelector));
  }

  function isSelectableTarget(target: EventTarget | null): boolean {
    const el = elementFromTarget(target);
    return Boolean(el?.closest(selectableSelector));
  }

  /** True when the document has a non-empty text selection (copyable). */
  function hasCopyableTextSelection(doc: Document = document): boolean {
    const sel = doc.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    return sel.toString().length > 0;
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    const el = elementFromTarget(target);
    if (!el) return false;
    if (el.closest(editorSelector)) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    const field = el.closest(TEXT_INPUT_SELECTOR);
    if (field instanceof HTMLTextAreaElement) {
      return !field.disabled && !field.readOnly;
    }
    if (field instanceof HTMLInputElement) {
      return !field.disabled && !field.readOnly;
    }
    return field instanceof HTMLSelectElement && !field.disabled;
  }

  function isTextEditingShortcut(event: KeyboardEvent): boolean {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return false;

    const key = event.key.toLowerCase();
    if (event.shiftKey && key === "z") return true;
    if (!event.shiftKey && !event.altKey) {
      return ["a", "c", "v", "x", "z", "y"].includes(key);
    }
    return false;
  }

  /**
   * Clipboard chords that must work for read-only selections (AI bubbles, …).
   * Cut is included because browsers treat it as copy on non-editable text.
   */
  function isSelectionClipboardShortcut(event: KeyboardEvent): boolean {
    if (!isTextEditingShortcut(event)) return false;
    const key = event.key.toLowerCase();
    return key === "c" || key === "a" || key === "x";
  }

  /** Browser / WebView shortcuts we never want the host to handle. */
  function isBrowserShortcut(event: KeyboardEvent): boolean {
    const key = event.key;
    const lower = key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;

    if (key === "F5" || key === "F12") return true;
    if (key === "F1" || key === "F11") return true;

    if (event.altKey && (key === "ArrowLeft" || key === "ArrowRight")) return true;

    if (!mod) return false;

    if (event.shiftKey) {
      if (lower === "i" || lower === "r" || lower === "delete") return true;
      if (lower === "j" || lower === "c") return true;
    }

    switch (lower) {
      case "r":
      case "p":
      case "f":
      case "g":
      case "h":
      case "j":
      case "t":
      case "d":
      case "l":
      case "u":
      case "=":
      case "+":
      case "-":
      case "_":
      case "0":
      case ".":
        return true;
      default:
        return false;
    }
  }

  /**
   * Block native WebView / browser shortcuts so the app shortcut layer owns chords.
   * Returns true when the event should be cancelled.
   */
  function shouldBlockNativeShortcut(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) return false;
    if (isShortcutRecordingActive()) return false;

    if (isInEditor(event.target)) return false;

    // Selected text in AI chat (or focus inside a selectable bubble) must be
    // copyable even though chrome is otherwise non-editable.
    if (
      isSelectionClipboardShortcut(event) &&
      (hasCopyableTextSelection() || isSelectableTarget(event.target))
    ) {
      return false;
    }

    if (isBrowserShortcut(event)) return true;

    if (isEditableTarget(event.target)) {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return false;
      return !isTextEditingShortcut(event);
    }

    return event.ctrlKey || event.metaKey || event.altKey;
  }

  function blockNativeShortcut(event: KeyboardEvent): void {
    if (!shouldBlockNativeShortcut(event)) return;
    event.preventDefault();
    if (isBrowserShortcut(event)) {
      event.stopPropagation();
    }
  }

  /** Install capture-phase guards that suppress WebView default shortcuts. */
  function installNativeShortcutGuard(doc: Document = document): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
      blockNativeShortcut(event);
    };

    doc.addEventListener("keydown", onKeyDown, true);
    return () => doc.removeEventListener("keydown", onKeyDown, true);
  }

  return {
    isShortcutRecordingActive,
    isInEditor,
    /** Alias kept for Inimark markdown editor call sites. */
    isInMarkdownEditor: isInEditor,
    isSelectableTarget,
    hasCopyableTextSelection,
    isEditableTarget,
    isTextEditingShortcut,
    isSelectionClipboardShortcut,
    isBrowserShortcut,
    shouldBlockNativeShortcut,
    blockNativeShortcut,
    installNativeShortcutGuard,
  };
}

/** Default guard matching Inimark editor / recording selectors. */
export const defaultShortcutGuard = createShortcutGuard();
