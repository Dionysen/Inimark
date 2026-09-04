import { createToggle } from "../ui/widgets/index.ts";

export interface ThemeToggleFieldOptions {
  label: string;
  varName: string;
  value: string;
  onChange: (value: string) => void;
}

function parseVisible(value: string): boolean {
  const n = Number.parseFloat(value);
  if (Number.isFinite(n)) return n > 0;
  return value !== "0" && value !== "false" && value !== "off";
}

export function createThemeToggleField(options: ThemeToggleFieldOptions): HTMLElement & {
  updateValue(next: string): void;
  destroy(): void;
} {
  const { label, varName, onChange } = options;
  let value = options.value;

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

  const toggle = createToggle({
    checked: parseVisible(value),
    title: label,
    onChange(checked) {
      value = checked ? "1" : "0";
      onChange(value);
    },
  });
  control.append(toggle.el);
  row.append(labelBlock, control);

  return Object.assign(row, {
    updateValue(next: string) {
      value = next;
      toggle.setChecked(parseVisible(next));
    },
    destroy() {
      toggle.destroy();
      row.remove();
    },
  });
}
