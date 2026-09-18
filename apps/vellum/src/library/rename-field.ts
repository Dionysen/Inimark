/** Class on `.inimark-tree-label` while its title is an inline rename field. */
export const RENAME_LABEL_CLASS = "is-renaming";

/**
 * Keep an inline rename field editable with the mouse.
 *
 * Chapter titles live inside `.inimark-tree-label`, which clips overflow and
 * disables selection. In WKWebView that blocks click-to-move-caret. Tree rows
 * also open or toggle on click, Enter, and Space; those actions destroy the
 * field. Pointer and key events stay on the input so the caret can move.
 */
export function bindRenameField(input: HTMLInputElement): void {
  const label = input.parentElement;
  if (label?.classList.contains("inimark-tree-label")) {
    label.classList.add(RENAME_LABEL_CLASS);
  }
  const stop = (event: Event) => {
    event.stopPropagation();
  };
  input.addEventListener("pointerdown", stop);
  input.addEventListener("mousedown", stop);
  input.addEventListener("click", stop);
  input.addEventListener("keydown", stop);
}
