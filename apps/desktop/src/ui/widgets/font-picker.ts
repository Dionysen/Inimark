import {
  FONT_PRESETS,
  type FontPresetId,
  resolveFontValue,
  quoteFontFamily,
  listSystemFonts,
  SYSTEM_FONT_SENTINEL,
  type SystemFontInfo,
} from "../../settings/system-fonts.ts";
import {
  applyOverlayPosition,
  onOutsideClick,
  positionBelowOrAbove,
} from "./overlay.ts";

export type FontPickerMode = "editor" | "code" | "ui";

export interface FontPickerOptions {
  mode: FontPickerMode;
  value: string;
  /** Built-in preset ids shown under "Presets" (system is always first). */
  presets: FontPresetId[];
  minWidth?: number | string;
  onChange?: (value: string) => void;
}

export interface FontPickerController {
  el: HTMLDivElement;
  setValue(value: string): void;
  getValue(): string;
  destroy(): void;
}

interface FontOption {
  value: string;
  label: string;
  previewFamily: string;
  group: "default" | "presets" | "mono" | "system";
}

const GROUP_LABELS: Record<FontOption["group"], string | null> = {
  default: null,
  presets: "Presets",
  mono: "Monospace",
  system: "System",
};

const CHEVRON = `<svg class="inimark-select__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

function fallbackPreset(mode: FontPickerMode): FontPresetId {
  return mode === "code" ? "code" : "system";
}

function buildStaticOptions(
  mode: FontPickerMode,
  presets: FontPresetId[],
): FontOption[] {
  const fallback = fallbackPreset(mode);
  const result: FontOption[] = [
    {
      value: SYSTEM_FONT_SENTINEL,
      label: "System default",
      previewFamily: resolveFontValue(SYSTEM_FONT_SENTINEL, fallback),
      group: "default",
    },
  ];

  for (const id of presets) {
    if (id === SYSTEM_FONT_SENTINEL) continue;
    const preset = FONT_PRESETS[id];
    if (!preset) continue;
    result.push({
      value: id,
      label: preset.label,
      previewFamily: preset.css,
      group: "presets",
    });
  }

  return result;
}

function appendSystemOptions(
  mode: FontPickerMode,
  fonts: SystemFontInfo[],
  into: FontOption[],
): void {
  const pushFamily = (f: SystemFontInfo, group: "mono" | "system") => {
    into.push({
      value: f.family,
      label: f.family,
      previewFamily: quoteFontFamily(f.family),
      group,
    });
  };

  if (mode === "code") {
    fonts.filter((f) => f.monospaced).forEach((f) => pushFamily(f, "mono"));
    fonts.filter((f) => !f.monospaced).forEach((f) => pushFamily(f, "system"));
  } else {
    fonts.forEach((f) => pushFamily(f, "system"));
  }
}

export function createFontPicker(options: FontPickerOptions): FontPickerController {
  let current = options.value;
  let open = false;
  let query = "";
  let fonts: SystemFontInfo[] = [];
  let loading = true;
  let stopOutside: (() => void) | null = null;
  let stopReposition: (() => void) | null = null;

  const root = document.createElement("div");
  root.className = "inimark-select inimark-font-picker";
  if (options.minWidth != null) {
    root.style.minWidth =
      typeof options.minWidth === "number" ? `${options.minWidth}px` : options.minWidth;
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "inimark-control inimark-field inimark-select__trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "inimark-select__label";

  trigger.insertAdjacentHTML("beforeend", CHEVRON);
  trigger.prepend(label);

  const panel = document.createElement("div");
  panel.className = "inimark-select-panel inimark-font-picker-panel";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;

  const search = document.createElement("input");
  search.type = "search";
  search.className = "inimark-font-picker-search";
  search.placeholder = "Search fonts…";
  search.autocomplete = "off";
  search.spellcheck = false;

  const list = document.createElement("div");
  list.className = "inimark-font-picker-list";

  panel.append(search, list);
  root.append(trigger);

  function allOptions(): FontOption[] {
    const opts = buildStaticOptions(options.mode, options.presets);
    appendSystemOptions(options.mode, fonts, opts);
    return opts;
  }

  function filteredOptions(): FontOption[] {
    const opts = allOptions();
    const q = query.trim().toLowerCase();
    if (!q) return opts;
    return opts.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }

  function selectedOption(): FontOption {
    const opts = allOptions();
    const found = opts.find((o) => o.value === current);
    if (found) return found;
    if (current && current !== SYSTEM_FONT_SENTINEL) {
      return {
        value: current,
        label: current in FONT_PRESETS ? FONT_PRESETS[current as FontPresetId].label : current,
        previewFamily: resolveFontValue(current, fallbackPreset(options.mode)),
        group: "system",
      };
    }
    return opts[0]!;
  }

  function syncLabel(): void {
    const selected = selectedOption();
    label.textContent = selected.label;
    label.style.fontFamily = selected.previewFamily;
    trigger.title = selected.label;
  }

  function close(): void {
    if (!open) return;
    open = false;
    query = "";
    search.value = "";
    root.classList.remove("is-open");
    trigger.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    panel.classList.remove("is-open");
    panel.hidden = true;
    stopOutside?.();
    stopOutside = null;
    stopReposition?.();
    stopReposition = null;
    panel.remove();
  }

  function select(value: string): void {
    current = value;
    syncLabel();
    options.onChange?.(current);
    close();
  }

  function renderList(): void {
    list.replaceChildren();
    if (loading) {
      const empty = document.createElement("div");
      empty.className = "inimark-font-picker-empty";
      empty.textContent = "Loading fonts…";
      list.append(empty);
      return;
    }

    const filtered = filteredOptions();
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inimark-font-picker-empty";
      empty.textContent = "No matching fonts";
      list.append(empty);
      return;
    }

    let lastGroup: FontOption["group"] | null = null;
    for (const opt of filtered) {
      if (opt.group !== lastGroup) {
        lastGroup = opt.group;
        const groupLabel = GROUP_LABELS[opt.group];
        if (groupLabel) {
          const group = document.createElement("div");
          group.className = "inimark-select-group";
          group.textContent = groupLabel;
          list.append(group);
        }
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-select-option";
      btn.setAttribute("role", "option");
      btn.textContent = opt.label;
      btn.style.fontFamily = opt.previewFamily;
      if (opt.value === current) btn.classList.add("is-selected");
      btn.addEventListener("click", () => select(opt.value));
      list.append(btn);
    }
  }

  function reposition(): void {
    const pos = positionBelowOrAbove(trigger.getBoundingClientRect(), 320);
    applyOverlayPosition(panel, pos);
  }

  function openPanel(): void {
    if (open || trigger.disabled) return;
    open = true;
    root.classList.add("is-open");
    trigger.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    document.body.append(panel);
    renderList();
    reposition();
    requestAnimationFrame(() => {
      panel.classList.add("is-open");
      search.focus();
    });
    stopOutside = onOutsideClick([root, panel], close);
    const onReposition = () => reposition();
    window.addEventListener("resize", onReposition);
    document.addEventListener("scroll", onReposition, true);
    stopReposition = () => {
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("scroll", onReposition, true);
    };
  }

  trigger.addEventListener("click", () => {
    if (open) close();
    else openPanel();
  });

  search.addEventListener("input", () => {
    query = search.value;
    renderList();
  });

  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const first = filteredOptions()[0];
      if (first) select(first.value);
    }
  });

  void listSystemFonts().then((listResult) => {
    fonts = listResult;
    loading = false;
    syncLabel();
    if (open) renderList();
  });

  syncLabel();

  return {
    el: root,
    setValue(value) {
      current = value;
      syncLabel();
      if (open) renderList();
    },
    getValue() {
      return current;
    },
    destroy() {
      close();
      root.remove();
    },
  };
}
