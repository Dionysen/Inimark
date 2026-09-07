const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 40;

let layer: HTMLDivElement | null = null;
let labelEl: HTMLSpanElement | null = null;
let metaEl: HTMLSpanElement | null = null;
let activeTarget: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function ensureLayer(): HTMLDivElement {
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "inimark-tooltip inimark-glass";
    layer.setAttribute("role", "tooltip");
    layer.hidden = true;

    labelEl = document.createElement("span");
    labelEl.className = "inimark-tooltip__label";

    metaEl = document.createElement("span");
    metaEl.className = "inimark-tooltip__meta";
    metaEl.hidden = true;

    layer.append(labelEl, metaEl);
    document.body.append(layer);
  }
  return layer;
}

function clearTimers(): void {
  if (showTimer != null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (hideTimer != null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function isTooltipDisabled(el: HTMLElement): boolean {
  if (el.matches(":disabled, [aria-disabled='true']")) return true;
  if (el.closest("[hidden]")) return true;
  return false;
}

/** Store tooltip text on an element and suppress the native browser tooltip. */
export function bindTooltip(el: HTMLElement, label: string, meta?: string): void {
  el.dataset.inimarkTooltip = label;
  if (meta) el.dataset.inimarkTooltipMeta = meta;
  else delete el.dataset.inimarkTooltipMeta;
  el.removeAttribute("title");
}

/** Update tooltip copy (e.g. after locale change). */
export function updateTooltip(el: HTMLElement, label: string, meta?: string): void {
  bindTooltip(el, label, meta);
}

export function unbindTooltip(el: HTMLElement): void {
  delete el.dataset.inimarkTooltip;
  delete el.dataset.inimarkTooltipMeta;
  el.removeAttribute("title");
  if (activeTarget === el) hide();
}

function migrateLegacyTooltip(el: HTMLElement): void {
  const legacy = el.dataset.tooltip;
  if (legacy) {
    bindTooltip(el, legacy);
    delete el.dataset.tooltip;
  }
}

function readTooltipContent(el: HTMLElement): { label: string; meta?: string } | null {
  migrateLegacyTooltip(el);

  const title = el.getAttribute("title");
  if (title) {
    bindTooltip(el, title);
  }

  const label = el.dataset.inimarkTooltip?.trim();
  if (!label) return null;

  const meta = el.dataset.inimarkTooltipMeta?.trim();
  return meta ? { label, meta } : { label };
}

function findTooltipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const el = node.closest(
    "[data-inimark-tooltip], [data-tooltip], [title]",
  ) as HTMLElement | null;
  if (!el || el.closest(".inimark-tooltip")) return null;
  if (isTooltipDisabled(el)) return null;
  return readTooltipContent(el) ? el : null;
}

function positionTooltip(anchor: HTMLElement): void {
  const tip = ensureLayer();
  const rect = anchor.getBoundingClientRect();
  const gap = 6;

  tip.style.visibility = "hidden";
  tip.hidden = false;
  tip.classList.add("is-visible");

  const tipRect = tip.getBoundingClientRect();
  let top = rect.bottom + gap;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;

  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
  if (top + tipRect.height > window.innerHeight - 8) {
    top = rect.top - gap - tipRect.height;
  }
  top = Math.max(8, top);

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.style.visibility = "visible";
}

function show(target: HTMLElement, content: { label: string; meta?: string }): void {
  const tip = ensureLayer();
  activeTarget = target;
  labelEl!.textContent = content.label;
  if (content.meta) {
    metaEl!.textContent = content.meta;
    metaEl!.hidden = false;
  } else {
    metaEl!.textContent = "";
    metaEl!.hidden = true;
  }
  tip.id = `inimark-tooltip-${target.id || "active"}`;
  target.setAttribute("aria-describedby", tip.id);
  positionTooltip(target);
}

function hide(): void {
  clearTimers();
  if (activeTarget) {
    activeTarget.removeAttribute("aria-describedby");
    activeTarget = null;
  }
  if (!layer) return;
  layer.classList.remove("is-visible");
  layer.hidden = true;
  layer.style.visibility = "";
}

function scheduleShow(target: HTMLElement | null): void {
  clearTimers();
  if (!target) {
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
    return;
  }
  const content = readTooltipContent(target);
  if (!content) {
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
    return;
  }
  if (activeTarget === target && layer?.classList.contains("is-visible")) return;

  showTimer = setTimeout(() => {
    const latest = readTooltipContent(target);
    if (!latest) return;
    show(target, latest);
  }, SHOW_DELAY_MS);
}

function onPointerOver(event: PointerEvent): void {
  if (event.pointerType === "touch") return;
  const target = findTooltipTarget(event.target);
  if (target) scheduleShow(target);
}

function onPointerOut(event: PointerEvent): void {
  const related = event.relatedTarget;
  if (activeTarget) {
    if (related instanceof Node && activeTarget.contains(related)) return;
    scheduleShow(null);
    return;
  }
  if (!findTooltipTarget(event.target)) scheduleShow(null);
}

function onFocusIn(event: FocusEvent): void {
  const target = findTooltipTarget(event.target);
  if (target) scheduleShow(target);
}

function onFocusOut(event: FocusEvent): void {
  const related = event.relatedTarget;
  if (activeTarget) {
    if (related instanceof Node && activeTarget.contains(related)) return;
    scheduleShow(null);
  }
}

function onScroll(): void {
  if (!activeTarget) return;
  if (layer?.classList.contains("is-visible")) {
    positionTooltip(activeTarget);
  }
}

/** Mount the shared tooltip layer and wire document-level show/hide behavior. */
export function initTooltipLayer(doc: Document = document): () => void {
  if (initialized) return () => {};
  initialized = true;

  doc.addEventListener("pointerover", onPointerOver, true);
  doc.addEventListener("pointerout", onPointerOut, true);
  doc.addEventListener("focusin", onFocusIn, true);
  doc.addEventListener("focusout", onFocusOut, true);
  doc.addEventListener("scroll", onScroll, true);
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
  window.addEventListener("blur", hide);

  return () => {
    initialized = false;
    hide();
    doc.removeEventListener("pointerover", onPointerOver, true);
    doc.removeEventListener("pointerout", onPointerOut, true);
    doc.removeEventListener("focusin", onFocusIn, true);
    doc.removeEventListener("focusout", onFocusOut, true);
    doc.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("blur", hide);
    layer?.remove();
    layer = null;
    labelEl = null;
    metaEl = null;
  };
}
