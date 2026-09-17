/** Suppress text selection and native context menus outside editable surfaces. */

/** Default selectors for Inimark-style editors / AI chat (apps may override). */
export const DEFAULT_EDITABLE_SELECTOR = [
  ".inimark-editor-host",
  ".ProseMirror",
  ".cm-editor",
  ".cm-content",
  ".inimark-ai-bubble",
  ".inimark-ai-tool-body",
  ".inimark-ai-thinking-body",
  '[contenteditable="true"]',
].join(", ");

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "image",
  "hidden",
]);

function elementFromTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

/** True when the event is inside an editable surface or a text field. */
export function isEditableChromeTarget(
  target: EventTarget | null,
  editableSelector: string = DEFAULT_EDITABLE_SELECTOR,
): boolean {
  const el = elementFromTarget(target);
  if (!el) return false;
  if (el.closest(editableSelector)) return true;

  const field = el.closest("input, textarea");
  if (field instanceof HTMLTextAreaElement) {
    return !field.disabled && !field.readOnly;
  }
  if (field instanceof HTMLInputElement) {
    if (NON_TEXT_INPUT_TYPES.has(field.type)) return false;
    return !field.disabled && !field.readOnly;
  }
  return false;
}

export interface ChromeGuardsOptions {
  /** CSS selector for product editable hosts. Default: {@link DEFAULT_EDITABLE_SELECTOR}. */
  editableSelector?: string;
}

/**
 * Install document-level guards shared by the main editor window and settings.
 * - Blocks text selection outside the editor / text inputs (WKWebView-safe).
 * - Always suppresses the native browser context menu; feature menus still open
 *   via their own `contextmenu` listeners.
 */
export function installChromeGuards(
  doc: Document = document,
  options: ChromeGuardsOptions = {},
): () => void {
  const editableSelector =
    options.editableSelector ?? DEFAULT_EDITABLE_SELECTOR;

  const onSelectStart = (event: Event): void => {
    // File-tree / chrome pointer DnD — never allow editor selection mid-drag.
    if (document.documentElement.classList.contains("is-pointer-dnd")) {
      event.preventDefault();
      return;
    }
    if (isEditableChromeTarget(event.target, editableSelector)) return;
    // Allow selection start on movable chrome (pointer DnD / native drag).
    const el = elementFromTarget(event.target);
    if (el?.closest(".is-draggable, [draggable='true']")) return;
    event.preventDefault();
  };

  const onContextMenu = (event: Event): void => {
    // Always kill the OS/browser menu. Custom menus (file tree, …) still fire.
    event.preventDefault();
  };

  const onMouseDown = (event: MouseEvent): void => {
    // WebKit may select a word on right-click before contextmenu; stop that in chrome.
    if (event.button !== 2) return;
    if (isEditableChromeTarget(event.target, editableSelector)) return;
    event.preventDefault();
  };

  doc.addEventListener("selectstart", onSelectStart, true);
  doc.addEventListener("contextmenu", onContextMenu, true);
  doc.addEventListener("mousedown", onMouseDown, true);

  return () => {
    doc.removeEventListener("selectstart", onSelectStart, true);
    doc.removeEventListener("contextmenu", onContextMenu, true);
    doc.removeEventListener("mousedown", onMouseDown, true);
  };
}
