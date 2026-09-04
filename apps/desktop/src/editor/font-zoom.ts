import {
  applySettings,
  saveSettings,
  type AppSettings,
} from "../settings/store.ts";

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;
const TOAST_MS = 1500;

export interface FontZoomOptions {
  /** Editor surface used for hover / hit-testing. */
  editorHost: HTMLElement;
  /** Overlay parent (usually the main column). */
  toastHost: HTMLElement;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
}

/**
 * Ctrl/Cmd + mouse wheel zooms editor + mono font sizes together (Δ kept),
 * when the pointer is over the editor. Shows a brief top toast with the size.
 */
export function mountEditorFontZoom(options: FontZoomOptions): () => void {
  const { editorHost, toastHost, getSettings, setSettings } = options;

  let toastEl: HTMLElement | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function clearToast(): void {
    if (toastTimer != null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastEl?.remove();
    toastEl = null;
  }

  function showToast(size: number): void {
    clearToast();
    const el = document.createElement("div");
    el.className = "inimark-font-size-indicator";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = `Font size ${size}px`;
    toastHost.append(el);
    toastEl = el;
    toastTimer = setTimeout(() => {
      toastTimer = null;
      el.remove();
      if (toastEl === el) toastEl = null;
    }, TOAST_MS);
  }

  function collectScrollLocks(target: HTMLElement | null) {
    const locks: Array<{ el: HTMLElement; top: number; left: number; height: number }> = [];
    let el: HTMLElement | null = target;
    while (el) {
      if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
        locks.push({
          el,
          top: el.scrollTop,
          left: el.scrollLeft,
          height: el.scrollHeight,
        });
      }
      if (el === editorHost) break;
      el = el.parentElement;
    }
    return locks;
  }

  function restoreScrollLocks(
    locks: Array<{ el: HTMLElement; top: number; left: number; height: number }>,
    proportional: boolean,
  ): void {
    for (const lock of locks) {
      if (proportional && lock.height > 0) {
        lock.el.scrollTop = (lock.top / lock.height) * lock.el.scrollHeight;
      } else {
        lock.el.scrollTop = lock.top;
      }
      lock.el.scrollLeft = lock.left;
    }
  }

  function nudge(delta: 1 | -1): number | null {
    const current = getSettings();
    const nextFont = Math.round(current.fontSize) + delta;
    const nextMono = Math.round(current.codeFontSize) + delta;
    // Keep (fontSize - codeFontSize) by moving both in lockstep; abort at either bound.
    if (
      nextFont < FONT_SIZE_MIN ||
      nextFont > FONT_SIZE_MAX ||
      nextMono < FONT_SIZE_MIN ||
      nextMono > FONT_SIZE_MAX
    ) {
      return null;
    }
    const next: AppSettings = {
      ...current,
      fontSize: nextFont,
      codeFontSize: nextMono,
    };
    setSettings(next);
    saveSettings(next);
    applySettings(next);
    return nextFont;
  }

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.altKey || event.shiftKey) return;

    const target = event.target as HTMLElement | null;
    if (!target || !editorHost.contains(target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const locks = collectScrollLocks(target);
    const dir: 1 | -1 = event.deltaY < 0 ? 1 : -1;
    const nextSize = nudge(dir);

    restoreScrollLocks(locks, false);
    if (nextSize != null) {
      showToast(nextSize);
      requestAnimationFrame(() => restoreScrollLocks(locks, true));
    }
  };

  document.addEventListener("wheel", onWheel, { passive: false, capture: true });

  return () => {
    document.removeEventListener("wheel", onWheel, { capture: true });
    clearToast();
  };
}
