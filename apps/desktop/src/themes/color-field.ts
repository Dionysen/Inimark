import {
  applyCheckerboard,
  applyCheckerboardUnder,
  formatColor,
  hsvaToRgba,
  parseColor,
  pickColorWithEyeDropper,
  rgbaToHsva,
  type HsvaColor,
} from "./color-utils.ts";
import { createIconButton, createTextField } from "../ui/widgets/index.ts";
import { updateTooltip } from "../ui/widgets/tooltip.ts";
import { t } from "../i18n/index.ts";

export interface ThemeColorFieldOptions {
  label: string;
  description: string;
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

type PopoverParts = {
  sv: HTMLElement;
  svThumb: HTMLElement;
  hueThumb: HTMLElement;
  alphaTrack: HTMLElement;
  alphaThumb: HTMLElement;
  alphaVal: HTMLElement;
};

export function createThemeColorField(options: ThemeColorFieldOptions): HTMLElement {
  const { label, description, onChange } = options;
  let value = options.value;
  let open = false;
  let hsva = rgbaToHsva(parseColor(value));
  let textDraft = value;
  let parts: PopoverParts | null = null;

  const row = document.createElement("div");
  row.className = "theme-editor-row";

  const labelBlock = document.createElement("div");
  labelBlock.className = "theme-editor-label-block";
  const labelEl = document.createElement("label");
  labelEl.className = "theme-editor-label";
  labelEl.textContent = label;
  const descEl = document.createElement("span");
  descEl.className = "theme-editor-desc";
  descEl.textContent = description;
  labelBlock.append(labelEl, descEl);

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
  applyCheckerboard(checker, 6);
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
    label: t("settings.theme.copyColor"),
    title: t("settings.theme.copyColor"),
  });
  copyBtn.classList.add("theme-editor-icon-btn");
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  const dropperBtn = createIconButton({
    label: t("settings.theme.eyedropper"),
    title: t("settings.theme.eyedropper"),
  });
  dropperBtn.classList.add("theme-editor-icon-btn");
  dropperBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 5 3 3"/><path d="M18 2c.5.5 2 2.5 2 4 0 1-.5 2-2 2s-2-.5-2-2 1.5-3.5 2-4Z"/></svg>`;
  dropperBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropperBtn.disabled) return;
    const wasOpen = open;
    if (wasOpen) setOpen(false);
    dropperBtn.disabled = true;
    document.documentElement.classList.add("is-color-picking");
    updateTooltip(dropperBtn, t("settings.theme.eyedropperHint"));
    let failed = false;
    try {
      const hex = await pickColorWithEyeDropper();
      if (!hex) {
        if (wasOpen) setOpen(true);
        return;
      }
      const next = rgbaToHsva(parseColor(hex));
      next.a = hsva.a;
      commit(next);
    } catch (err) {
      failed = true;
      console.error("Eyedropper failed", err);
      updateTooltip(dropperBtn, t("settings.theme.eyedropperFailed"));
      window.setTimeout(() => {
        updateTooltip(dropperBtn, t("settings.theme.eyedropper"));
      }, 1600);
      if (wasOpen) setOpen(true);
    } finally {
      document.documentElement.classList.remove("is-color-picking");
      dropperBtn.disabled = false;
      if (!failed) {
        updateTooltip(dropperBtn, t("settings.theme.eyedropper"));
      }
    }
  });

  group.append(swatch, text.el, dropperBtn, copyBtn);

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
    syncPopover();
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

  function syncPopover(): void {
    if (!parts) return;
    const rgba = hsvaToRgba(hsva);
    const solid = formatColor({ ...rgba, a: 1 });
    const preview = formatColor(rgba);

    parts.sv.style.background = svBackground(hsva.h);
    parts.svThumb.style.left = `${hsva.s}%`;
    parts.svThumb.style.top = `${100 - hsva.v}%`;
    parts.svThumb.style.background = solid;

    parts.hueThumb.style.left = `${(hsva.h / 360) * 100}%`;
    applyCheckerboardUnder(
      parts.alphaTrack,
      `linear-gradient(to right, transparent, ${solid})`,
      5,
    );
    parts.alphaThumb.style.left = `${hsva.a * 100}%`;
    parts.alphaVal.textContent = `${Math.round(hsva.a * 100)}%`;
    fill.style.background = preview === "transparent" ? "transparent" : preview;
  }

  function bindTrackDrag(
    track: HTMLElement,
    read: (clientX: number, clientY: number, rect: DOMRect) => void,
  ): void {
    let dragging = false;
    track.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      track.setPointerCapture(e.pointerId);
      read(e.clientX, e.clientY, track.getBoundingClientRect());
    });
    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      read(e.clientX, e.clientY, track.getBoundingClientRect());
    });
    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (track.hasPointerCapture(e.pointerId)) {
        track.releasePointerCapture(e.pointerId);
      }
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
  }

  function buildPopover(): void {
    popover.replaceChildren();

    const sv = document.createElement("div");
    sv.className = "theme-color-sv";
    const svThumb = document.createElement("span");
    svThumb.className = "theme-color-sv-thumb";
    sv.append(svThumb);

    bindTrackDrag(sv, (clientX, clientY, rect) => {
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      commit({ ...hsva, s: x * 100, v: (1 - y) * 100 });
    });

    const sliders = document.createElement("div");
    sliders.className = "theme-color-sliders";

    const hueRow = document.createElement("div");
    hueRow.className = "theme-color-slider-row";
    const hueTrack = document.createElement("div");
    hueTrack.className = "theme-color-slider-track";
    hueTrack.style.background = hueGradient();
    const hueSlider = document.createElement("div");
    hueSlider.className = "theme-color-slider";
    const hueThumb = document.createElement("span");
    hueThumb.className = "theme-color-slider-thumb";
    hueSlider.append(hueThumb);
    hueTrack.append(hueSlider);
    hueRow.append(document.createTextNode("Hue"), hueTrack);

    bindTrackDrag(hueSlider, (clientX, _clientY, rect) => {
      const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      commit({ ...hsva, h: t * 360 });
    });

    const alphaRow = document.createElement("div");
    alphaRow.className = "theme-color-slider-row";
    const alphaTrack = document.createElement("div");
    alphaTrack.className = "theme-color-slider-track theme-color-alpha-track";
    const alphaSlider = document.createElement("div");
    alphaSlider.className = "theme-color-slider";
    const alphaThumb = document.createElement("span");
    alphaThumb.className = "theme-color-slider-thumb";
    alphaSlider.append(alphaThumb);
    alphaTrack.append(alphaSlider);
    const alphaVal = document.createElement("span");
    alphaVal.className = "theme-color-alpha-value";
    alphaRow.append(document.createTextNode("Alpha"), alphaTrack, alphaVal);

    bindTrackDrag(alphaSlider, (clientX, _clientY, rect) => {
      const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      commit({ ...hsva, a: t });
    });

    sliders.append(hueRow, alphaRow);
    popover.append(sv, sliders);

    parts = { sv, svThumb, hueThumb, alphaTrack, alphaThumb, alphaVal };
    syncPopover();
  }

  function setOpen(next: boolean): void {
    open = next;
    popover.hidden = !open;
    swatch.setAttribute("aria-expanded", String(open));
    if (open) {
      hsva = rgbaToHsva(parseColor(value));
      textDraft = value;
      buildPopover();
      document.body.append(popover);
      requestAnimationFrame(() => placePopover());
    } else {
      parts = null;
      popover.remove();
      refresh();
    }
  }

  swatch.addEventListener("click", () => setOpen(!open));

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      copyBtn.title = t("settings.theme.copied");
      window.setTimeout(() => {
        copyBtn.title = t("settings.theme.copyColor");
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
      parts = null;
      popover.remove();
    },
  });
}
