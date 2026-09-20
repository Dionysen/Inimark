/** Empty document chrome is separate from the writing surface and never saved. */
export function mountEditorEmptyState(
  column: HTMLElement,
  editorHost: HTMLElement,
  editor: HTMLElement,
  icon: string,
  message: string,
) {
  const empty = document.createElement("div");
  empty.className = "vellum-editor-empty";
  const artwork = document.createElement("div");
  artwork.className = "vellum-editor-empty-icon";
  artwork.setAttribute("aria-hidden", "true");
  // Trusted bundled SVG: keep the app mark, discard its fixed-color background.
  artwork.innerHTML = icon;
  artwork.querySelectorAll("rect, defs").forEach((node) => node.remove());
  artwork.querySelectorAll("path").forEach((node) => node.setAttribute("fill", "currentColor"));
  artwork.querySelector("svg")?.setAttribute("focusable", "false");
  const hint = document.createElement("p");
  hint.setAttribute("role", "status");
  hint.textContent = message;
  empty.append(artwork, hint);
  column.append(empty);

  const setOpen = (open: boolean) => {
    column.classList.toggle("has-no-article", !open);
    empty.hidden = open;
    editorHost.hidden = !open;
    editorHost.inert = !open;
    editor.contentEditable = open ? "true" : "false";
    if (!open) editor.blur();
  };
  setOpen(false);
  return {
    setOpen,
    setMessage(message: string) { hint.textContent = message; },
    destroy() { empty.remove(); },
  };
}
