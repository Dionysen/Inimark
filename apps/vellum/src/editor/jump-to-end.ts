/**
 * Floating "jump to end" affordance.
 *
 * While the reader has scrolled away from the end of the document, a pill
 * button floats over the lower-middle of the editor. Clicking it scrolls the
 * article to the end (which rests mid-viewport thanks to the end scroll pad)
 * and places the caret at the very end.
 */

import { onLocaleChange, t } from "../i18n/index.ts";
import type { PlaintextEditor } from "./plaintext.ts";

export interface JumpToEndController {
  destroy(): void;
}

/** Below this many px from the end we consider the view "at the end". */
const AT_END_THRESHOLD_PX = 40;

/**
 * @param mountHost  Positioning context for the button (the editor column).
 * @param scrollHost The scrolling editor container (`editor.el`'s parent).
 * @param editor     The plaintext editor to focus at the end.
 */
export function mountJumpToEndButton(
  mountHost: HTMLElement,
  scrollHost: HTMLElement,
  editor: PlaintextEditor,
): JumpToEndController {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vellum-jump-to-end";
  button.textContent = t("editor.focusToEnd");
  mountHost.append(button);

  const updateVisibility = (): void => {
    const distanceFromEnd =
      scrollHost.scrollHeight - scrollHost.clientHeight - scrollHost.scrollTop;
    button.classList.toggle("is-visible", distanceFromEnd > AT_END_THRESHOLD_PX);
  };

  const onScroll = (): void => updateVisibility();

  const onClick = (): void => {
    scrollHost.scrollTop = scrollHost.scrollHeight;
    editor.focusAtEnd();
  };

  // The button floats outside the scroll container, so a native wheel over it
  // would not reach the editor. Forward wheel deltas to keep scrolling smooth.
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const unit = scrollHost.clientHeight;
    const scale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? unit
          : 1;
    scrollHost.scrollTop += event.deltaY * scale;
  };

  button.addEventListener("click", onClick);
  button.addEventListener("wheel", onWheel, { passive: false });
  scrollHost.addEventListener("scroll", onScroll, { passive: true });

  // Content height changes (typing, opening an article) also move the end.
  const contentObserver = new ResizeObserver(() => updateVisibility());
  contentObserver.observe(editor.el);

  const unsubscribeLocale = onLocaleChange(() => {
    button.textContent = t("editor.focusToEnd");
  });

  updateVisibility();

  return {
    destroy() {
      button.removeEventListener("click", onClick);
      button.removeEventListener("wheel", onWheel);
      scrollHost.removeEventListener("scroll", onScroll);
      contentObserver.disconnect();
      unsubscribeLocale();
      button.remove();
    },
  };
}
