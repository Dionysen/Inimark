import {
  createIconButton,
  createMenu,
  menuIcons,
  type MenuController,
} from "@dionysen/ui";
import {
  listLibraries,
  type LibraryRecord,
} from "../libraries/store.ts";
import { libraryIcon, settingsIcon } from "../ui/product-icons.ts";

export interface LibraryDock {
  el: HTMLElement;
  setActive(library: LibraryRecord | null): void;
  refreshList(): void;
  destroy(): void;
}

export interface LibraryDockOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  onOpenSettings: () => void;
  onAddLibrary: () => void | Promise<void>;
  onSwitchLibrary: (id: string) => void | Promise<void>;
  onCloseLibrary: () => void | Promise<void>;
}

/**
 * Floating library pill at the bottom of the sidebar (Inimark-style),
 * built on shared `@dionysen/ui` menu + icon-button primitives.
 */
export function mountLibraryDock(
  host: HTMLElement,
  options: LibraryDockOptions,
): LibraryDock {
  const dock = document.createElement("div");
  dock.className = "inimark-sidebar-dock";

  const libraryWrap = document.createElement("div");
  libraryWrap.className = "inimark-library-bar-wrap";

  const libraryBar = document.createElement("button");
  libraryBar.type = "button";
  libraryBar.className = "inimark-library-bar";
  libraryBar.setAttribute("aria-haspopup", "menu");
  libraryBar.setAttribute("aria-expanded", "false");
  libraryBar.title = options.t("library.libraries");
  libraryBar.innerHTML = `${libraryIcon()}<span class="inimark-library-bar-label">${options.t("library.noLibrary")}</span>`;
  const libraryLabel = libraryBar.querySelector(
    ".inimark-library-bar-label",
  ) as HTMLElement;

  const settingsBtn = createIconButton({
    label: options.t("library.openSettings"),
    title: options.t("library.openSettings"),
    html: settingsIcon(),
  });
  settingsBtn.classList.add("inimark-library-bar-settings");

  libraryWrap.append(libraryBar, settingsBtn);
  dock.append(libraryWrap);

  const menu: MenuController = createMenu();
  menu.el.classList.add("inimark-library-menu");
  menu.setDismissAnchors([libraryBar]);
  dock.append(menu.el);
  host.append(dock);

  let activeLibraryId: string | null = null;
  let savedLibraries: LibraryRecord[] = listLibraries();

  const closeMenu = () => {
    menu.setOpen(false);
    libraryBar.setAttribute("aria-expanded", "false");
  };

  const renderLibraryList = () => {
    menu.clear();
    menu.setPath("");

    const listGroup = menu.appendGroup(
      "inimark-library-menu__scroll inimark-scrollbar",
    );
    const actionsGroup = menu.appendGroup("inimark-library-menu__actions");

    if (savedLibraries.length === 0) {
      menu.setEmptyIn(listGroup, options.t("library.noneSaved"));
    } else {
      for (const library of savedLibraries) {
        menu.addItemTo(listGroup, {
          label: library.rootName,
          icon: menuIcons.library,
          meta: library.rootPath,
          metaPlacement: "below",
          selected: library.id === activeLibraryId,
          onClick() {
            closeMenu();
            void options.onSwitchLibrary(library.id);
          },
        });
      }
    }

    menu.addDividerTo(actionsGroup);
    menu.addItemTo(actionsGroup, {
      label: options.t("library.add"),
      icon: menuIcons.folderPlus,
      onClick() {
        closeMenu();
        void options.onAddLibrary();
      },
    });
    menu.addItemTo(actionsGroup, {
      label: options.t("library.close"),
      icon: menuIcons.close,
      disabled: !activeLibraryId,
      onClick() {
        closeMenu();
        void options.onCloseLibrary();
      },
    });
  };

  const toggleMenu = () => {
    const next = !menu.isOpen();
    if (next) {
      savedLibraries = listLibraries();
      renderLibraryList();
    }
    menu.setOpen(next);
    libraryBar.setAttribute("aria-expanded", next ? "true" : "false");
  };

  libraryBar.addEventListener("click", () => toggleMenu());
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeMenu();
    options.onOpenSettings();
  });

  const onDocClick = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (menu.isOpen() && !(target && dock.contains(target))) {
      closeMenu();
    }
  };
  document.addEventListener("click", onDocClick);

  return {
    el: dock,
    setActive(library) {
      activeLibraryId = library?.id ?? null;
      libraryLabel.textContent =
        library?.rootName ?? options.t("library.noLibrary");
      libraryBar.title = library
        ? `${library.rootName}\n${library.rootPath}`
        : options.t("library.libraries");
    },
    refreshList() {
      savedLibraries = listLibraries();
      if (menu.isOpen()) renderLibraryList();
    },
    destroy() {
      document.removeEventListener("click", onDocClick);
      menu.destroy();
      dock.remove();
    },
  };
}
