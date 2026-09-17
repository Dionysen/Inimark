import {
  closeWindow,
  minimizeWindow,
  onWindowMaximizedChange,
  supportsWindowChrome,
  toggleMaximizeWindow,
  usesNativeWindowControls,
} from "@dionysen/shell";
import {
  windowCloseIcon,
  windowMaximizeIcon,
  windowMinimizeIcon,
  windowRestoreIcon,
} from "@dionysen/ui";
import { t } from "../i18n/index.ts";

export interface TitleBarController {
  setTitle(title: string): void;
  destroy(): void;
}

export interface TitleBarOptions {
  title?: string;
  controlMode?: "full" | "close-only";
  onClose?: () => void | Promise<void>;
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

/** Minimal product titlebar with optional window chrome buttons. */
export function mountTitleBar(
  host: HTMLElement,
  options: TitleBarOptions = {},
): TitleBarController {
  const controlMode = options.controlMode ?? "full";
  const showControls =
    !usesNativeWindowControls() && supportsWindowChrome();

  host.className = "inimark-titlebar";
  host.setAttribute("data-tauri-drag-region", "deep");
  host.replaceChildren();

  const leading = document.createElement("div");
  leading.className = "inimark-titlebar-leading";

  const center = document.createElement("div");
  center.className = "inimark-titlebar-center";
  const titleEl = document.createElement("span");
  titleEl.className = "inimark-titlebar-title";
  titleEl.textContent = options.title ?? "";
  center.append(titleEl);

  const trailing = document.createElement("div");
  trailing.className = "inimark-titlebar-trailing";
  markNoDrag(trailing);

  let unlistenMaximize: (() => void) | null = null;

  if (showControls) {
    const controls = document.createElement("div");
    controls.className = "inimark-titlebar-controls inimark-titlebar-controls--native";
    if (controlMode === "close-only") {
      controls.classList.add("inimark-titlebar-controls--close-only");
    }

    if (controlMode === "full") {
      const minBtn = document.createElement("button");
      minBtn.type = "button";
      minBtn.className = "inimark-titlebar-btn";
      minBtn.setAttribute("aria-label", t("common.close"));
      minBtn.innerHTML = windowMinimizeIcon();
      minBtn.addEventListener("click", () => void minimizeWindow());

      const maxBtn = document.createElement("button");
      maxBtn.type = "button";
      maxBtn.className = "inimark-titlebar-btn";
      maxBtn.innerHTML = windowMaximizeIcon();
      maxBtn.addEventListener("click", () => void toggleMaximizeWindow());
      void onWindowMaximizedChange((maximized) => {
        maxBtn.innerHTML = maximized
          ? windowRestoreIcon()
          : windowMaximizeIcon();
      }).then((fn) => {
        unlistenMaximize = fn;
      });

      controls.append(minBtn, maxBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
    closeBtn.setAttribute("aria-label", t("common.close"));
    closeBtn.innerHTML = windowCloseIcon();
    closeBtn.addEventListener("click", () => {
      void (options.onClose?.() ?? closeWindow());
    });
    controls.append(closeBtn);
    trailing.append(controls);
  }

  host.append(leading, center, trailing);

  return {
    setTitle(title: string) {
      titleEl.textContent = title;
    },
    destroy() {
      unlistenMaximize?.();
      host.replaceChildren();
    },
  };
}
