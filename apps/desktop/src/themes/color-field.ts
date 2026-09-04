import {
  checkerboardCss,
  formatColor,
  hsvaToRgba,
  parseColor,
  pickColorWithEyeDropper,
  rgbaToHsva,
  supportsEyeDropper,
  type HsvaColor,
} from "./color-utils.ts";
import { createIconButton, createTextField } from "../ui/widgets/index.ts";

export interface ThemeColorFieldOptions {
  label: string;
  varName: string;
  value: string;
  onChange: (value: string) => void;
}

function hueGradient(): string {
  return "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";
}

function svBackground(h: number): string {
  const pure = formatColor(hsvaToRgba({ h, s: 100, v: 100, a: 1 }));
  return `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})`;
}

export function createThemeColorField(options: ThemeColorFieldOptions): HTMLElement {
  const { label, varName, onChange } = options;
  let value = options.value;
  let open = false;
  let hsva = rgbaToHsva(parseColor(value));
  let textDraft = value;

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
  group.className = "theme-editor-color-group";

  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "theme-color-swatch inimark-control";
  swatch.title = "Pick color";

  const checker = document.createElement("span");
  checker.className = "theme-color-swatch-checker";
  checker.style.backgroundImage = checkerboardCss();
  const fill = document.createElement("span");
  fill.className = "theme-color-swatch-fill";
  swatch.append(checker, fill);

  const text = createTextField({
    value,
    onChange(next) {
      if (open) {
        commit(rgbaToHsva(parseColor(next)));
      } else {
        value = next;
        onChange(next);
        hsva = rgbaToHsva(parseColor(value));
        refresh();
      }
    },
  });
  text.el.classList.add("theme-editor-color-input");
  text.input.addEventListener("input", () => {
    textDraft = text.input.value;
  });

  const copyBtn = createIconButton({
    label: "Copy color",
    title: "Copy color",
  });
  copyBtn.classList.add("theme-editor-icon-btn");
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  group.append(swatch, text.el, copyBtn);
  if (supportsEyeDropper()) {
    const dropperBtn = createIconButton({
      label: "Eyedropper",
      title: "Eyedropper",
    });
    dropperBtn.classList.add("theme-editor-icon-btn");
    dropperBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 5 3 3"/><path d="M18 2c.5.5 2 2.5 2 4 0 1-.5 2-2 2s-2-.5-2-2 1.5-3.5 2-4Z"/></svg>`;
    dropperBtn.addEventListener("click", async () => {
      const hex = await pickColorWithEyeDropper();
      if (!hex) return;
      const next = rgbaToHsva(parseColor(hex));
      next.a = hsva.a;
      commit(next);
    });
    group.append(dropperBtn);
  }

  const popover = document.createElement("div");
  popover.className = "theme-color-popover";
  popover.hidden = true;
  popover.setAttribute("role", "dialog");

  control.append(group);
  row.append(labelBlock, control, popover);

  function commit(next: HsvaColor): void {
    hsva = next;
    const formatted = formatColor(hsvaToRgba(next));
    textDraft = formatted;
    value = formatted;
    onChange(formatted);
    refresh();
    if (open) renderPopover();
  }

  function refresh(): void {
    const rgba = hsvaToRgba(hsva);
    const preview = formatColor(rgba);
    fill.style.background = preview === "transparent" ? "transparent" : preview;
    if (!open) text.setValue(value);
    else text.setValue(textDraft);
  }

  function placePopover(): void {
    const rect = swatch.getBoundingClientRect();
    const popW = popover.offsetWidth || 260;
    const popH = popover.offsetHeight || 320;
    let left = rect.right - popW;
    let top = rect.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
    if (top + popH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popH - 8);
    }
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.visibility = "visible";
  }

  function renderPopover(): void {
    popover.replaceChildren();
    const rgba = hsvaToRgba(hsva);
    const solid = formatColor({ ...rgba, a: 1 });
    const preview = formatColor(rgba);

    const sv = document.createElement("div");
    sv.className = "theme-color-sv";
    sv.style.background = svBackground(hsva.h);
    const svThumb = document.createElement("span");
    svThumb.className = "theme-color-sv-thumb";
    sv.append(svThumb);

    let svDragging = false;
    const updateSv = (clientX: number, clientY: number) => {
      const rect = sv.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      commit({ ...hsva, s: x * 100, v: (1 - y) * 100 });
    };
    sv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      svDragging = true;
      sv.setPointerCapture(e.pointerId);
      updateSv(e.clientX, e.clientY);
    });
    sv.addEventListener("pointermove", (e) => {
      if (!svDragging) return;
      updateSv(e.clientX, e.clientY);
    });
    sv.addEventListener("pointerup", () => {
      svDragging = false;
    });
    sv.addEventListener("pointercancel", () => {
      svDragging = false;
    });

    const sliders = document.createElement("div");
    sliders.className = "theme-color-sliders";

    const hueRow = document.createElement("div");
    hueRow.className = "theme-color-slider-row";
    const hueTrack = document.createElement("div");
    hueTrack.className = "theme-color-slider-track";
    hueTrack.style.background = hueGradient();
    const hueSlider = createHueAlphaSlider(0, 360, hsva.h, (h) => commit({ ...hsva, h }));
    hueTrack.append(hueSlider);
    hueRow.append(document.createTextNode("Hue"), hueTrack);

    const alphaRow = document.createElement("div");
    alphaRow.className = "theme-color-slider-row";
    const alphaTrack = document.createElement("div");
    alphaTrack.className = "theme-color-slider-track theme-color-alpha-track";
    alphaTrack.style.backgroundImage = `${checkerboardCss()}, linear-gradient(to right, transparent, ${solid})`;
    alphaTrack.style.backgroundSize = "10px 10px, 100% 100%";
    const alphaSlider = createHueAlphaSlider(0, 100, Math.round(hsva.a * 100), (pct) =>
      commit({ ...hsva, a: pct / 100 }),
    );
    alphaTrack.append(alphaSlider);
    const alphaVal = document.createElement("span");
    alphaVal.className = "theme-color-alpha-value";
    alphaVal.textContent = `${Math.round(hsva.a * 100)}%`;
    alphaRow.append(document.createTextNode("Alpha"), alphaTrack, alphaVal);

    sliders.append(hueRow, alphaRow);
    popover.append(sv, sliders);

    svThumb.style.left = `${hsva.s}%`;
    svThumb.style.top = `${100 - hsva.v}%`;
    svThumb.style.background = solid;
    fill.style.background = preview === "transparent" ? "transparent" : preview;
  }

  function setOpen(next: boolean): void {
    open = next;
    popover.hidden = !open;
    swatch.setAttribute("aria-expanded", String(open));
    if (open) {
      hsva = rgbaToHsva(parseColor(value));
      textDraft = value;
      renderPopover();
      document.body.append(popover);
      requestAnimationFrame(() => placePopover());
    } else {
      popover.remove();
      refresh();
    }
  }

  swatch.addEventListener("click", () => setOpen(!open));

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      copyBtn.title = "Copied!";
      window.setTimeout(() => {
        copyBtn.title = "Copy color";
      }, 1200);
    } catch {
      /* ignore */
    }
  });

  const onDocClick = (e: MouseEvent) => {
    if (!open) return;
    const t = e.target as Node;
    if (row.contains(t) || popover.contains(t)) return;
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) setOpen(false);
  };
  document.addEventListener("mousedown", onDocClick);
  document.addEventListener("keydown", onKey);

  refresh();

  return Object.assign(row, {
    updateValue(next: string) {
      value = next;
      if (!open) {
        hsva = rgbaToHsva(parseColor(value));
        refresh();
      }
    },
    destroy() {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      popover.remove();
    },
  });
}

function createHueAlphaSlider(
  min: number,
  max: number,
  value: number,
  onChange: (v: number) => void,
): HTMLElement {
  const el = document.createElement("div");
  el.className = "theme-color-slider";
  const thumb = document.createElement("span");
  thumb.className = "theme-color-slider-thumb";
  el.append(thumb);

  let dragging = false;
  const update = (clientX: number) => {
    const rect = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(min + t * (max - min));
  };

  const setThumb = (v: number) => {
    const pct = ((v - min) / (max - min)) * 100;
    thumb.style.left = `${pct}%`;
  };

  setThumb(value);

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragging = true;
    el.setPointerCapture(e.pointerId);
    update(e.clientX);
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    update(e.clientX);
  });
  el.addEventListener("pointerup", () => {
    dragging = false;
  });

  return el;
}
