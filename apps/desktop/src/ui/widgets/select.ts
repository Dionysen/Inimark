import {
  applyOverlayPosition,
  onOutsideClick,
  positionBelowOrAbove,
} from "./overlay.ts";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

export interface SelectOptions {
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  title?: string;
  minWidth?: number | string;
  onChange?: (value: string) => void;
}

export interface SelectController {
  el: HTMLDivElement;
  setValue(value: string): void;
  getValue(): string;
  setOptions(options: SelectOption[]): void;
  destroy(): void;
}

const CHEVRON = `<svg class="inimark-select__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

export function createSelect(options: SelectOptions): SelectController {
  let current = options.value;
  let items = [...options.options];
  let open = false;
  let activeIndex = -1;
  let stopOutside: (() => void) | null = null;

  const root = document.createElement("div");
  root.className = "inimark-select";
  if (options.minWidth != null) {
    root.style.minWidth =
      typeof options.minWidth === "number" ? `${options.minWidth}px` : options.minWidth;
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "inimark-control inimark-field inimark-select__trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (options.title) trigger.title = options.title;
  if (options.disabled) trigger.disabled = true;

  const label = document.createElement("span");
  label.className = "inimark-select__label";

  trigger.insertAdjacentHTML("beforeend", CHEVRON);
  trigger.prepend(label);

  const panel = document.createElement("div");
  panel.className = "inimark-select-panel";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;

  function labelFor(value: string): string {
    return items.find((item) => item.value === value)?.label ?? value;
  }

  function syncLabel(): void {
    label.textContent = labelFor(current);
  }

  function close(): void {
    if (!open) return;
    open = false;
    root.classList.remove("is-open");
    trigger.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    panel.classList.remove("is-open");
    panel.hidden = true;
    stopOutside?.();
    stopOutside = null;
  }

  function renderOptions(): void {
    panel.replaceChildren();
    let lastGroup: string | undefined;
    items.forEach((item, index) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        const group = document.createElement("div");
        group.className = "inimark-select-group";
        group.textContent = item.group;
        panel.append(group);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-select-option";
      btn.setAttribute("role", "option");
      btn.dataset.value = item.value;
      btn.dataset.index = String(index);
      btn.textContent = item.label;
      if (item.value === current) btn.classList.add("is-selected");
      if (index === activeIndex) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        current = item.value;
        syncLabel();
        options.onChange?.(current);
        close();
      });
      panel.append(btn);
    });
  }

  function openPanel(): void {
    if (open || trigger.disabled) return;
    open = true;
    activeIndex = Math.max(
      0,
      items.findIndex((item) => item.value === current),
    );
    renderOptions();
    root.classList.add("is-open");
    trigger.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    document.body.append(panel);
    const pos = positionBelowOrAbove(trigger.getBoundingClientRect());
    applyOverlayPosition(panel, pos);
    requestAnimationFrame(() => panel.classList.add("is-open"));
    stopOutside = onOutsideClick([root, panel], close);
  }

  function toggle(): void {
    if (open) close();
    else openPanel();
  }

  trigger.addEventListener("click", toggle);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openPanel();
      else {
        activeIndex = Math.min(items.length - 1, activeIndex + 1);
        renderOptions();
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openPanel();
      else {
        activeIndex = Math.max(0, activeIndex - 1);
        renderOptions();
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openPanel();
        return;
      }
      if (activeIndex >= 0) {
        const item = items[activeIndex];
        if (item) {
          current = item.value;
          syncLabel();
          options.onChange?.(current);
          close();
        }
      }
      return;
    }
    if (event.key === "Escape") {
      close();
    }
  });

  root.append(trigger);
  syncLabel();

  return {
    el: root,
    setValue(value) {
      current = value;
      syncLabel();
      if (open) renderOptions();
    },
    getValue() {
      return current;
    },
    setOptions(next) {
      items = [...next];
      syncLabel();
      if (open) renderOptions();
    },
    destroy() {
      close();
      panel.remove();
      root.remove();
    },
  };
}
