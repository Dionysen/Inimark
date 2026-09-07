const EDITOR_SELECTOR = [
  ".inimark-editor-host",
  ".ProseMirror",
  ".cm-editor",
  ".cm-content",
].join(", ");

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

export function isShortcutRecordingActive(doc: Document = document): boolean {
  const active = doc.activeElement;
  return Boolean(
    active?.closest(".inimark-settings-shortcut-capture.is-recording"),
  );
}

export function isInMarkdownEditor(target: EventTarget | null): boolean {
  const el = elementFromTarget(target);
  return Boolean(el?.closest(EDITOR_SELECTOR));
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = elementFromTarget(target);
  if (!el) return false;
  if (el.closest(EDITOR_SELECTOR)) return true;
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

export function isTextEditingShortcut(event: KeyboardEvent): boolean {
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
export function isBrowserShortcut(event: KeyboardEvent): boolean {
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
export function shouldBlockNativeShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  if (isShortcutRecordingActive()) return false;

  if (isBrowserShortcut(event)) return true;

  const inEditor = isInMarkdownEditor(event.target);
  if (inEditor) return false;

  if (isEditableTarget(event.target)) {
    return !isTextEditingShortcut(event);
  }

  return event.ctrlKey || event.metaKey || event.altKey;
}

export function blockNativeShortcut(event: KeyboardEvent): void {
  if (!shouldBlockNativeShortcut(event)) return;
  event.preventDefault();
  if (isBrowserShortcut(event)) {
    event.stopPropagation();
  }
}

/** Install capture-phase guards that suppress WebView default shortcuts. */
export function installNativeShortcutGuard(doc: Document = document): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    blockNativeShortcut(event);
  };

  doc.addEventListener("keydown", onKeyDown, true);
  return () => doc.removeEventListener("keydown", onKeyDown, true);
}
