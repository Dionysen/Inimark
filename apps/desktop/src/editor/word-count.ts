import type { Editor } from "@inimark/editor";
import { onLocaleChange, t } from "../i18n/index.ts";
import {
  type AppSettings,
  type WordCountSettings,
} from "../settings/store.ts";
import {
  acquireExclusiveLayer,
  releaseExclusiveLayer,
} from "../ui/exclusive-layer.ts";
import { createToggle } from "../ui/widgets/toggle.ts";

const UPDATE_DEBOUNCE_MS = 80;
const LAYER_ID = Symbol("word-count-panel");

export interface WordCountController {
  scheduleUpdate(): void;
  syncChrome(): void;
  destroy(): void;
}

export interface WordCountOptions {
  host: HTMLElement;
  editor: Editor;
  getSettings: () => AppSettings;
  onWordCountChange: (partial: Partial<WordCountSettings>) => void;
  onTypewriterModeChange?: (enabled: boolean) => void;
}

/** Strip common Markdown syntax for plain-text character counts (source mode). */
export function stripMarkdownForCount(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""),
    )
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]*)(?:\|[^\]]*)?]]/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/<[^>]+>/g, "");
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function countCharacters(text: string): number {
  return text.length;
}

function getPlainText(editor: Editor): string {
  if (editor.isSourceMode()) {
    return stripMarkdownForCount(editor.getMarkdown());
  }
  return editor.view.state.doc.textContent;
}

function getCountText(editor: Editor, settings: WordCountSettings): string {
  const raw = settings.includeSymbols ? editor.getMarkdown() : getPlainText(editor);
  const count = countCharacters(raw);
  return t("wordCount.label", { count: formatCount(count) });
}

const SCROLL_TOP_ICON =
  `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m18 15-6-6-6 6"/></svg>`;
const SCROLL_BOTTOM_ICON =
  `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>`;
const TYPEWRITER_ICON =
  `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M6 8h12"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 8v8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M6 16h12"/></svg>`;
const SOURCE_MODE_ICON =
  `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m8 9-4 3 4 3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m16 9 4 3-4 3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M13 6 11 18"/></svg>`;

export function mountWordCount(options: WordCountOptions): WordCountController {
  const { host, editor, getSettings, onWordCountChange, onTypewriterModeChange } = options;

  const root = document.createElement("div");
  root.className = "inimark-statusbar inimark-statusbar--right";

  const zone = document.createElement("div");
  zone.className = "inimark-statusbar-zone";

  const leftRoot = document.createElement("div");
  leftRoot.className = "inimark-statusbar inimark-statusbar--left";

  const leftZone = document.createElement("div");
  leftZone.className = "inimark-statusbar-zone";

  const leftChrome = document.createElement("div");
  leftChrome.className = "inimark-statusbar-chrome";

  const sourceModeBtn = document.createElement("button");
  sourceModeBtn.type = "button";
  sourceModeBtn.className = "inimark-statusbar-scroll-btn";
  sourceModeBtn.innerHTML = SOURCE_MODE_ICON;

  leftChrome.append(sourceModeBtn);
  leftZone.append(leftChrome);
  leftRoot.append(leftZone);

  const chrome = document.createElement("div");
  chrome.className = "inimark-statusbar-chrome";

  const scrollRow = document.createElement("div");
  scrollRow.className = "inimark-statusbar-scroll";

  const scrollTopBtn = document.createElement("button");
  scrollTopBtn.type = "button";
  scrollTopBtn.className = "inimark-statusbar-scroll-btn";
  scrollTopBtn.innerHTML = SCROLL_TOP_ICON;

  const scrollBottomBtn = document.createElement("button");
  scrollBottomBtn.type = "button";
  scrollBottomBtn.className = "inimark-statusbar-scroll-btn";
  scrollBottomBtn.innerHTML = SCROLL_BOTTOM_ICON;

  scrollRow.append(scrollTopBtn, scrollBottomBtn);

  const typewriterBtn = document.createElement("button");
  typewriterBtn.type = "button";
  typewriterBtn.className = "inimark-statusbar-scroll-btn";
  typewriterBtn.innerHTML = TYPEWRITER_ICON;

  const countBtn = document.createElement("button");
  countBtn.type = "button";
  countBtn.className = "inimark-statusbar-count";

  const panel = document.createElement("div");
  panel.className = "inimark-statusbar-panel";

  const header = document.createElement("div");
  header.className = "inimark-statusbar-header";
  const title = document.createElement("div");
  title.className = "inimark-statusbar-title";

  const body = document.createElement("div");
  body.className = "inimark-statusbar-body";

  const row = document.createElement("div");
  row.className = "inimark-statusbar-row";

  const rowMeta = document.createElement("div");
  rowMeta.className = "inimark-statusbar-row-meta";
  const rowTitle = document.createElement("div");
  rowTitle.className = "inimark-statusbar-row-title";
  const rowDesc = document.createElement("p");
  rowDesc.className = "inimark-statusbar-row-desc";

  const rowControl = document.createElement("div");
  rowControl.className = "inimark-statusbar-row-control";

  const includeSymbolsToggle = createToggle({
    checked: getSettings().wordCount.includeSymbols,
    onChange(checked) {
      onWordCountChange({ includeSymbols: checked });
      refreshToggle();
      renderCount();
    },
  });

  rowMeta.append(rowTitle, rowDesc);
  rowControl.append(includeSymbolsToggle.el);
  row.append(rowMeta, rowControl);
  body.append(row);
  header.append(title);
  panel.append(header, body);

  const footer = document.createElement("div");
  footer.className = "inimark-statusbar-footer";
  footer.append(typewriterBtn, countBtn, panel);

  chrome.append(scrollRow, footer);
  zone.append(chrome);
  root.append(zone);
  host.append(leftRoot, root);

  let open = false;
  let updateTimer: ReturnType<typeof setTimeout> | null = null;

  function closePanel(): void {
    if (!open) return;
    open = false;
    root.classList.remove("is-open");
    countBtn.classList.remove("is-active");
    releaseExclusiveLayer(LAYER_ID);
    updateRevealState();
  }

  function openPanel(): void {
    if (open) return;
    open = true;
    root.classList.add("is-open");
    countBtn.classList.add("is-active");
    acquireExclusiveLayer(LAYER_ID, closePanel, {
      contains: (node) => node != null && root.contains(node),
    });
    updateRevealState();
  }

  function refreshToggle(): void {
    includeSymbolsToggle.setChecked(getSettings().wordCount.includeSymbols);
  }

  function refreshLabels(): void {
    scrollTopBtn.title = t("editor.scrollToTop");
    scrollTopBtn.setAttribute("aria-label", t("editor.scrollToTop"));
    scrollBottomBtn.title = t("editor.scrollToBottom");
    scrollBottomBtn.setAttribute("aria-label", t("editor.scrollToBottom"));
    typewriterBtn.title = t("settings.editor.typewriter");
    typewriterBtn.setAttribute("aria-label", t("settings.editor.typewriter"));
    syncSourceModeButton();
    countBtn.title = t("wordCount.toggle");
    countBtn.setAttribute("aria-label", t("wordCount.toggle"));
    title.textContent = t("wordCount.panelTitle");
    rowTitle.textContent = t("wordCount.includeSymbols");
    rowDesc.textContent = t("wordCount.includeSymbolsDesc");
    includeSymbolsToggle.el.title = t("wordCount.includeSymbols");
  }

  function renderCount(): void {
    countBtn.textContent = getCountText(editor, getSettings().wordCount);
  }

  function scheduleUpdate(): void {
    if (updateTimer != null) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateTimer = null;
      renderCount();
    }, UPDATE_DEBOUNCE_MS);
  }

  countBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (open) closePanel();
    else openPanel();
  });

  function syncTypewriterButton(): void {
    const on = editor.isTypewriterMode();
    typewriterBtn.classList.toggle("is-active", on);
    typewriterBtn.setAttribute("aria-pressed", String(on));
  }

  function syncSourceModeButton(): void {
    const on = editor.isSourceMode();
    sourceModeBtn.classList.toggle("is-active", on);
    sourceModeBtn.setAttribute("aria-pressed", String(on));
    const sourceLabel = on ? t("editor.exitSourceMode") : t("editor.sourceMode");
    sourceModeBtn.title = sourceLabel;
    sourceModeBtn.setAttribute("aria-label", sourceLabel);
  }

  function updateRevealState(): void {
    const autoHide = getSettings().autoHideStatusbar;
    root.classList.toggle("inimark-statusbar--auto-hide", autoHide);
    leftRoot.classList.toggle("inimark-statusbar--auto-hide", autoHide);
    if (!autoHide) {
      zone.classList.remove("is-revealed");
      leftZone.classList.remove("is-revealed");
      return;
    }
    const revealed = open || zone.matches(":hover") || leftZone.matches(":hover");
    zone.classList.toggle("is-revealed", revealed);
    leftZone.classList.toggle("is-revealed", revealed);
  }

  function syncChrome(): void {
    syncTypewriterButton();
    syncSourceModeButton();
    updateRevealState();
  }

  function onZonePointerEnter(): void {
    if (!getSettings().autoHideStatusbar) return;
    zone.classList.add("is-revealed");
    leftZone.classList.add("is-revealed");
  }

  function onZonePointerLeave(): void {
    if (!getSettings().autoHideStatusbar || open) return;
    if (zone.matches(":hover") || leftZone.matches(":hover")) return;
    zone.classList.remove("is-revealed");
    leftZone.classList.remove("is-revealed");
  }

  zone.addEventListener("pointerenter", onZonePointerEnter);
  zone.addEventListener("pointerleave", onZonePointerLeave);
  leftZone.addEventListener("pointerenter", onZonePointerEnter);
  leftZone.addEventListener("pointerleave", onZonePointerLeave);

  scrollTopBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    editor.scrollToTop();
  });

  scrollBottomBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    editor.scrollToBottom();
  });

  typewriterBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const next = !editor.isTypewriterMode();
    editor.setTypewriterMode(next);
    onTypewriterModeChange?.(next);
    syncTypewriterButton();
  });

  sourceModeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    editor.toggleSource();
    syncSourceModeButton();
    scheduleUpdate();
  });

  const onSelectionChange = () => {
    const active = document.activeElement;
    if (!active || !host.contains(active)) return;
    scheduleUpdate();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) closePanel();
  };

  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("keydown", onKeyDown);
  const unsubscribeLocale = onLocaleChange(() => {
    refreshLabels();
    renderCount();
  });

  refreshLabels();
  refreshToggle();
  renderCount();
  syncChrome();

  return {
    scheduleUpdate,
    syncChrome,
    destroy() {
      if (updateTimer != null) clearTimeout(updateTimer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      unsubscribeLocale();
      closePanel();
      root.remove();
      leftRoot.remove();
    },
  };
}
