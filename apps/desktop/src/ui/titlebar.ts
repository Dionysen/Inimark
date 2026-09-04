import { usesNativeWindowControls } from "../platform/platform.ts";
import {
  closeWindow,
  minimizeWindow,
  onWindowMaximizedChange,
  supportsWindowChrome,
  toggleMaximizeWindow,
} from "../platform/window-chrome.ts";
import { createIconButton } from "./icon-button.ts";
import {
  windowCloseIcon,
  windowMaximizeIcon,
  windowMinimizeIcon,
  windowRestoreIcon,
} from "./window-icons.ts";

export type WindowControlMode = "full" | "close-only";

export interface TitleBarController {
  setTitle(title: string): void;
  destroy(): void;
}

export interface TitleBarOptions {
  appName?: string;
  title?: string;
  /** When omitted, shows custom controls in Tauri on non-macOS platforms. */
  showWindowControls?: boolean;
  controlMode?: WindowControlMode;
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

export function mountTitleBar(
  host: HTMLElement,
  options: TitleBarOptions = {},
): TitleBarController {
  const appName = options.appName ?? "Inimark";
  const controlMode = options.controlMode ?? "full";
  const showControls =
    !usesNativeWindowControls() &&
    (options.showWindowControls ?? supportsWindowChrome());
  let unlistenMaximize: (() => void) | null = null;

  host.className = "inimark-titlebar";
  host.setAttribute("data-tauri-drag-region", "deep");

  const leading = document.createElement("div");
  leading.className = "inimark-titlebar-leading";

  const brand = document.createElement("span");
  brand.className = "inimark-titlebar-brand";
  brand.textContent = appName;

  const center = document.createElement("div");
  center.className = "inimark-titlebar-center";

  const titleEl = document.createElement("span");
  titleEl.className = "inimark-titlebar-title";
  titleEl.textContent = options.title ?? "";

  const trailing = document.createElement("div");
  trailing.className = "inimark-titlebar-trailing";
  markNoDrag(trailing);

  leading.append(brand);
  center.append(titleEl);

  if (showControls) {
    const controls = document.createElement("div");
    controls.className = "inimark-titlebar-controls inimark-titlebar-controls--native";

    if (controlMode === "full") {
      const btnMinimize = createIconButton({
        label: "Minimize",
        title: "Minimize",
      });
      btnMinimize.className = "inimark-titlebar-btn";
      btnMinimize.innerHTML = windowMinimizeIcon();
      markNoDrag(btnMinimize);
      btnMinimize.addEventListener("click", () => void minimizeWindow());

      const btnMaximize = createIconButton({
        label: "Maximize",
        title: "Maximize",
      });
      btnMaximize.className = "inimark-titlebar-btn";
      btnMaximize.innerHTML = windowMaximizeIcon();
      markNoDrag(btnMaximize);

      function setMaximized(maximized: boolean): void {
        btnMaximize.innerHTML = maximized ? windowRestoreIcon() : windowMaximizeIcon();
        btnMaximize.title = maximized ? "Restore" : "Maximize";
        btnMaximize.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
      }

      btnMaximize.addEventListener("click", () => {
        void toggleMaximizeWindow();
      });

      const btnClose = createIconButton({
        label: "Close",
        title: "Close",
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => void closeWindow());

      controls.append(btnMinimize, btnMaximize, btnClose);

      void onWindowMaximizedChange(setMaximized).then((unlisten) => {
        unlistenMaximize = unlisten;
      });
    } else {
      const btnClose = createIconButton({
        label: "Close",
        title: "Close",
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => void closeWindow());
      controls.append(btnClose);
    }

    trailing.append(controls);
  }

  host.append(leading, center, trailing);

  const onDoubleClick = () => {
    if (!showControls || controlMode !== "full") return;
    void toggleMaximizeWindow();
  };
  leading.addEventListener("dblclick", onDoubleClick);
  center.addEventListener("dblclick", onDoubleClick);

  return {
    setTitle(title) {
      titleEl.textContent = title;
    },
    destroy() {
      unlistenMaximize?.();
      host.replaceChildren();
      host.className = "";
      host.removeAttribute("data-tauri-drag-region");
    },
  };
}
