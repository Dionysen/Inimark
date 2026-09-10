import { attachImePositionGuard } from "@inimark/editor";

/** App-wide IME caret sync for every editable surface in a desktop window. */
export function initImePositionGuard(): () => void {
  return attachImePositionGuard({
    root: document.documentElement,
    scrollRoot: document.documentElement,
  });
}
