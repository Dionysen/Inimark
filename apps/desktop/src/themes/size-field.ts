import type { ThemeSizeToken } from "./theme-tokens.ts";
import { createSlider, createTextField } from "../ui/widgets/index.ts";

export interface ThemeSizeFieldOptions {
  label: string;
  varName: string;
  value: string;
  meta: ThemeSizeToken;
  onChange: (value: string) => void;
}

function parseNumeric(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function toDisplay(value: string, meta: ThemeSizeToken): number {
  const n = parseNumeric(value);
  if (!Number.isFinite(n)) return meta.min;
  if (meta.asPercent) {
    const pct = n > 1 ? n : n * 100;
    return Math.min(meta.max, Math.max(meta.min, Math.round(pct)));
  }
  return Math.min(meta.max, Math.max(meta.min, n));
}

function formatDisplay(value: string, meta: ThemeSizeToken): string {
  const display = toDisplay(value, meta);
  if (meta.asPercent) return `${display}%`;
  const unit = meta.unit === "" ? "" : (meta.unit ?? "px");
  return unit ? `${Math.round(display)}${unit}` : String(display);
}

function commitFromDisplay(raw: string, meta: ThemeSizeToken): string {
  const n = parseNumeric(raw);
  const fallback = meta.min;
  const num = Number.isFinite(n) ? n : fallback;

  if (meta.asPercent) {
    let pct = num;
    if (!raw.includes("%") && num > 0 && num <= 1) pct = num * 100;
    const clamped = Math.min(meta.max, Math.max(meta.min, Math.round(pct)));
    const unitless = Math.round((clamped / 100) * 1000) / 1000;
    return String(unitless);
  }

  const unit = meta.unit === "" ? "" : (meta.unit ?? "px");
  const step = meta.step ?? 1;
  const rounded = step < 1 ? Math.round(num / step) * step : Math.round(num);
  const clamped = Math.min(meta.max, Math.max(meta.min, rounded));
  return unit ? `${clamped}${unit}` : String(clamped);
}

export function createThemeSizeField(options: ThemeSizeFieldOptions): HTMLElement & {
  updateValue(next: string): void;
} {
  const { label, varName, meta, onChange } = options;
  let value = options.value;
  let editing = false;
  let draft = formatDisplay(value, meta);

  const row = document.createElement("div");
  row.className = "theme-editor-row";

  const labelBlock = document.createElement("div");
  labelBlock.className = "theme-editor-label-block";
  const labelEl = document.createElement("label");
  labelEl.className = "theme-editor-label";
  labelEl.textContent = label;
  const varEl = document.createElement("span");
  varEl.className = "theme-editor-var-name";
  varEl.textContent = varName;
  labelBlock.append(labelEl, varEl);

  const control = document.createElement("div");
  control.className = "theme-editor-control";
  const group = document.createElement("div");
  group.className = "theme-editor-size-group";

  const slider = createSlider({
    min: meta.min,
    max: meta.max,
    step: meta.step ?? 1,
    value: toDisplay(value, meta),
    showValue: false,
    onInput(next) {
      onChange(commitFromDisplay(String(next), meta));
    },
  });
  slider.el.classList.add("theme-editor-size-slider");

  const text = createTextField({
    value: formatDisplay(value, meta),
    onInput(next) {
      draft = next;
    },
    onChange(next) {
      editing = false;
      onChange(commitFromDisplay(next, meta));
    },
  });
  text.el.classList.add("theme-editor-size-input");

  function refresh(): void {
    slider.setValue(toDisplay(value, meta));
    if (!editing) {
      text.setValue(formatDisplay(value, meta));
      draft = formatDisplay(value, meta);
    }
  }

  text.input.addEventListener("focus", () => {
    draft = formatDisplay(value, meta);
    editing = true;
  });
  text.input.addEventListener("blur", () => {
    editing = false;
    onChange(commitFromDisplay(draft, meta));
  });
  text.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editing = false;
      onChange(commitFromDisplay(draft, meta));
      text.input.blur();
    }
  });

  refresh();
  group.append(slider.el, text.el);
  control.append(group);
  row.append(labelBlock, control);

  return Object.assign(row, {
    updateValue(next: string) {
      value = next;
      refresh();
    },
  });
}
