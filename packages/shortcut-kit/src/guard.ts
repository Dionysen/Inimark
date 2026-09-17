export interface ShortcutGuardOptions {
  /** CSS selector for editor hosts where browser shortcuts must stay available. */
  editorSelector?: string;
  /** Selector for the shortcut-recording capture field. */
  recordingSelector?: string;
}

const DEFAULT_EDITOR_SELECTOR = [
  ".inimark-editor-host",
  ".ProseMirror",
  ".cm-editor",
  ".cm-content",
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
    isEditableTarget,
    isTextEditingShortcut,
    isBrowserShortcut,
    shouldBlockNativeShortcut,
    blockNativeShortcut,
    installNativeShortcutGuard,
  };
}

/** Default guard matching Inimark editor / recording selectors. */
export const defaultShortcutGuard = createShortcutGuard();
