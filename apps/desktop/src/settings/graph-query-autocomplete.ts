import { t } from "../i18n/index.ts";
import {
  applyGraphSuggestion,
  suggestGraphQuery,
  type GraphSuggestCatalog,
  type GraphSuggestItem,
} from "../graph/index.ts";
import {
  applyOverlayPosition,
  onOutsideClick,
  onScrollDismiss,
  positionBelowOrAbove,
} from "../ui/widgets/overlay.ts";

export type GraphQueryAutocompleteController = {
  destroy(): void;
};

export type GraphQueryAutocompleteOptions = {
  input: HTMLInputElement;
  getCatalog: () => GraphSuggestCatalog;
  /** Called after a suggestion is applied (or input changes while open). */
  onQueryCommit: (query: string) => void;
  limit?: number;
};

function itemDetail(item: GraphSuggestItem): string | undefined {
  if (item.kind === "operator") {
    const op = item.insert.replace(/:$/, "");
    if (op === "path") return t("settings.graph.suggestPath");
    if (op === "file") return t("settings.graph.suggestFile");
    if (op === "tag") return t("settings.graph.suggestTag");
  }
  return item.detail;
}

/**
 * Attach an Obsidian-style suggestion popup to a graph color-group query input.
 */
export function attachGraphQueryAutocomplete(
  options: GraphQueryAutocompleteOptions,
): GraphQueryAutocompleteController {
  const { input, getCatalog, onQueryCommit } = options;
  const limit = options.limit ?? 25;

  let open = false;
  let items: GraphSuggestItem[] = [];
  let activeIndex = 0;
  let replaceFrom = 0;
  let replaceTo = 0;
  let stopOutside: (() => void) | null = null;
  let stopScroll: (() => void) | null = null;

  const panel = document.createElement("div");
  panel.className =
    "inimark-menu inimark-glass inimark-graph-query-suggest inimark-scrollbar";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;

  const list = document.createElement("div");
  list.className = "inimark-menu__section";
  panel.append(list);
  document.body.append(panel);

  function close(): void {
    if (!open) return;
    open = false;
    panel.hidden = true;
    list.replaceChildren();
    stopOutside?.();
    stopOutside = null;
    stopScroll?.();
    stopScroll = null;
  }

  function position(): void {
    const rect = input.getBoundingClientRect();
    const pos = positionBelowOrAbove(rect, 240, 4, Math.max(rect.width, 180));
    applyOverlayPosition(panel, pos);
  }

  function renderItems(): void {
    list.replaceChildren();
    items.forEach((item, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-menu-item";
      btn.setAttribute("role", "option");
      if (index === activeIndex) btn.classList.add("is-active");

      const content = document.createElement("div");
      content.className = "inimark-menu-item__content";
      const nameRow = document.createElement("div");
      nameRow.className = "inimark-menu-item__name-row";
      const name = document.createElement("span");
      name.className = "inimark-menu-item__name";
      name.textContent = item.label;
      nameRow.append(name);
      content.append(nameRow);
      const detail = itemDetail(item);
      if (detail) {
        const meta = document.createElement("div");
        meta.className = "inimark-menu-item__meta inimark-menu-item__meta--below";
        meta.textContent = detail;
        content.append(meta);
        btn.classList.add("inimark-menu-item--meta-below");
      }
      btn.append(content);

      btn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyItem(item);
      });
      btn.addEventListener("mouseenter", () => {
        activeIndex = index;
        syncActive();
      });
      list.append(btn);
    });
  }

  function syncActive(): void {
    const children = [...list.children] as HTMLElement[];
    children.forEach((child, index) => {
      child.classList.toggle("is-active", index === activeIndex);
    });
    children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function applyItem(item: GraphSuggestItem): void {
    const applied = applyGraphSuggestion(input.value, replaceFrom, replaceTo, item.insert);
    input.value = applied.query;
    input.setSelectionRange(applied.caret, applied.caret);
    onQueryCommit(applied.query);
    close();
    // Re-open for chained completion (e.g. after choosing `tag:`).
    queueMicrotask(() => {
      if (document.activeElement === input) refresh();
    });
  }

  function refresh(): void {
    const caret = input.selectionStart ?? input.value.length;
    const result = suggestGraphQuery(input.value, caret, getCatalog(), limit);
    replaceFrom = result.from;
    replaceTo = result.to;
    items = result.items;
    activeIndex = items.length > 0 ? 0 : -1;

    if (items.length === 0) {
      close();
      return;
    }

    renderItems();
    position();
    panel.hidden = false;
    if (!open) {
      open = true;
      stopOutside = onOutsideClick([input, panel], close);
      stopScroll = onScrollDismiss(panel, close);
    }
  }

  const onInput = () => {
    onQueryCommit(input.value);
    refresh();
  };
  const onFocus = () => refresh();
  const onBlur = () => {
    // Delay so mousedown on a suggestion can apply first.
    window.setTimeout(() => {
      if (!panel.contains(document.activeElement)) close();
    }, 0);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!open || items.length === 0) {
      if (event.key === "ArrowDown" && document.activeElement === input) {
        refresh();
        if (items.length > 0) event.preventDefault();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      syncActive();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      syncActive();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      if (activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        applyItem(items[activeIndex]!);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  input.addEventListener("input", onInput);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("click", refresh);

  return {
    destroy() {
      close();
      input.removeEventListener("input", onInput);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("click", refresh);
      panel.remove();
    },
  };
}
