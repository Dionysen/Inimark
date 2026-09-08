import { onLocaleChange, t } from "../i18n/index.ts";
import { formatShortcutDisplay } from "../shortcuts/store.ts";
import { usesNativeWindowControls } from "../platform/platform.ts";
import {
  closeWindow,
  minimizeWindow,
  onWindowMaximizedChange,
  supportsWindowChrome,
  toggleMaximizeWindow,
} from "../platform/window-chrome.ts";
import { getThemeManager } from "../themes/manager.ts";
import { BUILTIN_THEMES } from "../themes/builtin.ts";
import { builtinThemeLabel } from "../themes/labels.ts";
import type { ThemeManifest } from "../themes/custom-theme-manager.ts";
import {
  createIconButton,
  moreIcon,
  rightSidebarToggleIcon,
  sidebarToggleIcon,
} from "./widgets/icon-button.ts";
import { createMenu, menuIcons } from "./widgets/menu.ts";
import {
  windowCloseIcon,
  windowMaximizeIcon,
  windowMinimizeIcon,
  windowRestoreIcon,
} from "./window-icons.ts";

export type WindowControlMode = "full" | "close-only";

export interface TitleBarController {
  setTitle(title: string): void;
  setSidebarOpen(open: boolean): void;
  setRightSidebarOpen(open: boolean): void;
  destroy(): void;
}

export interface SidebarToggleOptions {
  open: boolean;
  onToggle: () => void;
}

/** Actions for the editor titlebar overflow (“More”) menu. */
export interface TitleBarMoreMenuActions {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  onBack: () => void;
  onForward: () => void;
  canRename: () => boolean;
  onRename: () => void;
  canCopyPath: () => boolean;
  onCopyFileName: () => void;
  onCopyRelativePath: () => void;
  onCopyAbsolutePath: () => void;
  canAddBookmark: () => boolean;
  onAddBookmark: () => void;
  isSourceMode: () => boolean;
  onToggleSourceMode: () => void;
}

export interface TitleBarImmersiveMenuActions {
  getAutoHideTitlebar: () => boolean;
  getAutoHideStatusbar: () => boolean;
  onAutoHideTitlebarChange: (enabled: boolean) => void;
  onAutoHideStatusbarChange: (enabled: boolean) => void;
}

export interface TitleBarOptions {
  title?: string;
  /** When omitted, shows custom controls in Tauri on non-macOS platforms. */
  showWindowControls?: boolean;
  controlMode?: WindowControlMode;
  sidebarToggle?: SidebarToggleOptions;
  rightSidebarToggle?: SidebarToggleOptions;
  /** Editor chrome: overflow menu with appearance controls. */
  showMoreMenu?: boolean;
  moreMenuActions?: TitleBarMoreMenuActions;
  immersiveMenuActions?: TitleBarImmersiveMenuActions;
  onClose?: () => void | Promise<void>;
}

function appThemeLabel(themeId: string, customThemes: ThemeManifest[]): string {
  if ((BUILTIN_THEMES as readonly string[]).includes(themeId)) {
    return builtinThemeLabel(themeId);
  }
  if (themeId.startsWith("custom-")) {
    const manifestId = themeId.slice("custom-".length);
    const manifest = customThemes.find((entry) => entry.id === manifestId);
    if (manifest) return manifest.name;
  }
  return themeId;
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

function isWindowsPlatform(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("platform-windows")
  );
}

export function mountTitleBar(
  host: HTMLElement,
  options: TitleBarOptions = {},
): TitleBarController {
  const controlMode = options.controlMode ?? "full";
  const showControls =
    !usesNativeWindowControls() &&
    (options.showWindowControls ?? supportsWindowChrome());
  const showMoreMenu = options.showMoreMenu ?? Boolean(options.rightSidebarToggle);
  const moreActions = options.moreMenuActions;
  const immersiveActions = options.immersiveMenuActions;
  let unlistenMaximize: (() => void) | null = null;
  let sidebarOpen = options.sidebarToggle?.open ?? true;
  let rightSidebarOpen = options.rightSidebarToggle?.open ?? true;

  host.className = "inimark-titlebar";
  host.setAttribute("data-tauri-drag-region", "deep");

  const leading = document.createElement("div");
  leading.className = "inimark-titlebar-leading";

  let sidebarToggleBtn: HTMLButtonElement | null = null;
  if (options.sidebarToggle) {
    sidebarToggleBtn = createIconButton({
      label: sidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar"),
      title: sidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar"),
      onClick: options.sidebarToggle.onToggle,
    });
    sidebarToggleBtn.className = "inimark-sidebar-toggle-btn";
    sidebarToggleBtn.innerHTML = sidebarToggleIcon(sidebarOpen);
    markNoDrag(sidebarToggleBtn);
    leading.append(sidebarToggleBtn);
  }

  const center = document.createElement("div");
  center.className = "inimark-titlebar-center";

  const titleEl = document.createElement("span");
  titleEl.className = "inimark-titlebar-title";
  titleEl.textContent = options.title ?? "";

  const trailing = document.createElement("div");
  trailing.className = "inimark-titlebar-trailing";
  markNoDrag(trailing);

  center.append(titleEl);

  let moreBtn: HTMLButtonElement | null = null;
  let moreMenu: ReturnType<typeof createMenu> | null = null;
  let unsubscribeTheme: (() => void) | null = null;
  let stopOutsideClick: (() => void) | null = null;

  if (showMoreMenu) {
    moreMenu = createMenu();
    moreMenu.el.classList.add("inimark-titlebar-more-menu");
    moreMenu.setPath("");
    host.append(moreMenu.el);

    moreBtn = createIconButton({
      label: t("common.more"),
      title: t("common.more"),
      onClick: () => toggleMoreMenu(),
    });
    moreBtn.className = "inimark-sidebar-toggle-btn inimark-titlebar-more-btn";
    moreBtn.innerHTML = moreIcon();
    moreBtn.setAttribute("aria-haspopup", "menu");
    moreBtn.setAttribute("aria-expanded", "false");
    markNoDrag(moreBtn);
    trailing.append(moreBtn);

    const onDocMouseDown = (event: MouseEvent) => {
      if (!moreMenu?.isOpen()) return;
      const target = event.target as Node | null;
      if (moreBtn?.contains(target) || moreMenu.contains(target)) return;
      closeMoreMenu();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    stopOutsideClick = () => document.removeEventListener("mousedown", onDocMouseDown);

    unsubscribeTheme = getThemeManager().subscribe(() => {
      if (moreMenu?.isOpen()) renderMoreMenu();
    });
  }

  let rightSidebarToggleBtn: HTMLButtonElement | null = null;
  if (options.rightSidebarToggle) {
    rightSidebarToggleBtn = createIconButton({
      label: rightSidebarOpen
        ? t("common.collapseRightSidebar")
        : t("common.expandRightSidebar"),
      title: rightSidebarOpen
        ? t("common.collapseRightSidebar")
        : t("common.expandRightSidebar"),
      onClick: options.rightSidebarToggle.onToggle,
    });
    rightSidebarToggleBtn.className =
      "inimark-sidebar-toggle-btn inimark-right-sidebar-titlebar-toggle";
    rightSidebarToggleBtn.innerHTML = rightSidebarToggleIcon(rightSidebarOpen);
    markNoDrag(rightSidebarToggleBtn);
    trailing.append(rightSidebarToggleBtn);
  }

  if (showControls) {
    const controls = document.createElement("div");
    controls.className = "inimark-titlebar-controls inimark-titlebar-controls--native";
    if (controlMode === "close-only") {
      controls.classList.add("inimark-titlebar-controls--close-only");
    }

    if (controlMode === "full") {
      const btnMinimize = createIconButton({
        label: t("common.minimize"),
        title: t("common.minimize"),
      });
      btnMinimize.className = "inimark-titlebar-btn";
      btnMinimize.innerHTML = windowMinimizeIcon();
      markNoDrag(btnMinimize);
      btnMinimize.addEventListener("click", () => void minimizeWindow());

      const btnMaximize = createIconButton({
        label: t("common.maximize"),
        title: t("common.maximize"),
      });
      btnMaximize.className = "inimark-titlebar-btn";
      btnMaximize.innerHTML = windowMaximizeIcon();
      markNoDrag(btnMaximize);

      function setMaximized(maximized: boolean): void {
        btnMaximize.innerHTML = maximized ? windowRestoreIcon() : windowMaximizeIcon();
        btnMaximize.title = maximized ? t("common.restore") : t("common.maximize");
        btnMaximize.setAttribute(
          "aria-label",
          maximized ? t("common.restore") : t("common.maximize"),
        );
      }

      btnMaximize.addEventListener("click", () => {
        void toggleMaximizeWindow();
      });

      const btnClose = createIconButton({
        label: t("common.close"),
        title: t("common.close"),
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => {
        void (options.onClose ?? closeWindow)();
      });

      controls.append(btnMinimize, btnMaximize, btnClose);

      void onWindowMaximizedChange(setMaximized).then((unlisten) => {
        unlistenMaximize = unlisten;
      });
    } else {
      const btnClose = createIconButton({
        label: t("common.close"),
        title: t("common.close"),
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => {
        void (options.onClose ?? closeWindow)();
      });
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

  function closeMoreMenu(): void {
    if (!moreMenu || !moreBtn) return;
    moreMenu.setOpen(false);
    moreBtn.setAttribute("aria-expanded", "false");
  }

  function positionMoreMenu(): void {
    if (!moreMenu || !moreBtn) return;
    const rect = moreBtn.getBoundingClientRect();
    const menuWidth = Math.max(160, moreMenu.el.offsetWidth || 160);
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    moreMenu.el.style.top = `${rect.bottom + 4}px`;
    moreMenu.el.style.left = `${left}px`;
  }

  function renderMoreMenu(): void {
    if (!moreMenu) return;
    const themeManager = getThemeManager();
    const { resolvedMode } = themeManager.getSnapshot();
    moreMenu.clear();
    moreMenu.setPath("");

    if (moreActions) {
      moreMenu.addItem({
        label: t("titlebar.more.back"),
        icon: menuIcons.back,
        disabled: !moreActions.canGoBack(),
        onClick() {
          closeMoreMenu();
          moreActions.onBack();
        },
      });
      moreMenu.addItem({
        label: t("titlebar.more.forward"),
        icon: menuIcons.forward,
        disabled: !moreActions.canGoForward(),
        onClick() {
          closeMoreMenu();
          moreActions.onForward();
        },
      });
      moreMenu.addDivider();
      moreMenu.addItem({
        label: t("titlebar.more.rename"),
        icon: menuIcons.rename,
        disabled: !moreActions.canRename(),
        onClick() {
          closeMoreMenu();
          moreActions.onRename();
        },
      });
      moreMenu.addSubmenuItem({
        label: t("titlebar.more.copy"),
        icon: menuIcons.copy,
        items: [
          {
            label: t("titlebar.more.copyFileName"),
            disabled: !moreActions.canCopyPath(),
            onClick() {
              closeMoreMenu();
              moreActions.onCopyFileName();
            },
          },
          {
            label: t("titlebar.more.copyRelativePath"),
            disabled: !moreActions.canCopyPath(),
            onClick() {
              closeMoreMenu();
              moreActions.onCopyRelativePath();
            },
          },
          {
            label: t("titlebar.more.copyAbsolutePath"),
            disabled: !moreActions.canCopyPath(),
            onClick() {
              closeMoreMenu();
              moreActions.onCopyAbsolutePath();
            },
          },
        ],
      });
      moreMenu.addItem({
        label: t("titlebar.more.addBookmark"),
        icon: menuIcons.bookmark,
        disabled: !moreActions.canAddBookmark(),
        onClick() {
          closeMoreMenu();
          moreActions.onAddBookmark();
        },
      });
      moreMenu.addDivider();
      moreMenu.addItem({
        label: moreActions.isSourceMode()
          ? t("titlebar.more.wysiwygMode")
          : t("titlebar.more.sourceMode"),
        icon: menuIcons.sourceMode,
        meta: formatShortcutDisplay(["Ctrl", "/"]),
        onClick() {
          closeMoreMenu();
          moreActions.onToggleSourceMode();
        },
      });
      moreMenu.addDivider();
    }

    if (immersiveActions) {
      moreMenu.addSubmenuItem({
        label: t("titlebar.more.immersiveEditing"),
        icon: menuIcons.immersive,
        items: [
          {
            label: t("titlebar.more.autoHideTitlebar"),
            checked: immersiveActions.getAutoHideTitlebar(),
            onClick() {
              immersiveActions.onAutoHideTitlebarChange(
                !immersiveActions.getAutoHideTitlebar(),
              );
              renderMoreMenu();
            },
          },
          {
            label: t("titlebar.more.autoHideStatusbar"),
            checked: immersiveActions.getAutoHideStatusbar(),
            onClick() {
              immersiveActions.onAutoHideStatusbarChange(
                !immersiveActions.getAutoHideStatusbar(),
              );
              renderMoreMenu();
            },
          },
        ],
      });
    }

    const { theme, customThemes } = themeManager.getSnapshot();
    moreMenu.addSubmenuItem({
      label: t("titlebar.more.themeSettings"),
      icon: menuIcons.theme,
      meta: appThemeLabel(theme, customThemes),
      items: [
        ...BUILTIN_THEMES.map((themeId) => ({
          label: builtinThemeLabel(themeId),
          checked: theme === themeId,
          onClick() {
            themeManager.setTheme(themeId);
            renderMoreMenu();
          },
        })),
        ...customThemes.map((manifest) => {
          const themeId = `custom-${manifest.id}`;
          return {
            label: manifest.name,
            checked: theme === themeId,
            onClick() {
              themeManager.setTheme(themeId);
              renderMoreMenu();
            },
          };
        }),
      ],
    });

    moreMenu.addItem({
      label: t("settings.theme.appearanceMode"),
      icon: menuIcons.appearance,
      meta: t(`settings.theme.${resolvedMode}`),
      onClick() {
        const { resolvedMode: current } = themeManager.getSnapshot();
        themeManager.setAppearanceMode(current === "light" ? "dark" : "light");
      },
    });
  }

  function toggleMoreMenu(): void {
    if (!moreMenu || !moreBtn) return;
    if (moreMenu.isOpen()) {
      closeMoreMenu();
      return;
    }
    renderMoreMenu();
    moreMenu.setOpen(true);
    moreBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => positionMoreMenu());
  }

  function updateMoreButton(): void {
    if (!moreBtn) return;
    const label = t("common.more");
    moreBtn.title = label;
    moreBtn.setAttribute("aria-label", label);
  }

  function updateSidebarToggle(): void {
    if (!sidebarToggleBtn) return;
    // Obsidian-style: titlebar toggle only when sidebar is collapsed.
    sidebarToggleBtn.hidden = sidebarOpen;
    sidebarToggleBtn.innerHTML = sidebarToggleIcon(sidebarOpen);
    const label = sidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar");
    sidebarToggleBtn.title = label;
    sidebarToggleBtn.setAttribute("aria-label", label);
  }

  function updateRightSidebarToggle(): void {
    if (!rightSidebarToggleBtn) return;
    // Windows: keep the titlebar toggle always visible (fixed left of captions).
    // Other platforms: Obsidian-style — only when the right sidebar is collapsed.
    const pinToggle = isWindowsPlatform();
    rightSidebarToggleBtn.hidden = pinToggle ? false : rightSidebarOpen;
    rightSidebarToggleBtn.innerHTML = rightSidebarToggleIcon(rightSidebarOpen);
    const label = rightSidebarOpen
      ? t("common.collapseRightSidebar")
      : t("common.expandRightSidebar");
    rightSidebarToggleBtn.title = label;
    rightSidebarToggleBtn.setAttribute("aria-label", label);
  }

  updateSidebarToggle();
  updateRightSidebarToggle();
  updateMoreButton();
  const unsubscribeLocale = onLocaleChange(() => {
    updateSidebarToggle();
    updateRightSidebarToggle();
    updateMoreButton();
    if (moreMenu?.isOpen()) renderMoreMenu();
  });

  return {
    setTitle(title) {
      titleEl.textContent = title;
    },
    setSidebarOpen(open) {
      sidebarOpen = open;
      updateSidebarToggle();
    },
    setRightSidebarOpen(open) {
      rightSidebarOpen = open;
      updateRightSidebarToggle();
      if (moreMenu?.isOpen()) {
        requestAnimationFrame(() => positionMoreMenu());
      }
    },
    destroy() {
      unsubscribeLocale();
      unsubscribeTheme?.();
      stopOutsideClick?.();
      closeMoreMenu();
      moreMenu?.destroy();
      unlistenMaximize?.();
      host.replaceChildren();
      host.className = "";
      host.removeAttribute("data-tauri-drag-region");
    },
  };
}
