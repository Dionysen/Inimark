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
  destroy(): void;
}

export interface WordCountOptions {
  host: HTMLElement;
  editor: Editor;
  getSettings: () => AppSettings;
  onWordCountChange: (partial: Partial<WordCountSettings>) => void;
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

export function mountWordCount(options: WordCountOptions): WordCountController {
  const { host, editor, getSettings, onWordCountChange } = options;

  const root = document.createElement("div");
  root.className = "inimark-statusbar";

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
  footer.append(countBtn, panel);

  root.append(scrollRow, footer);
  host.append(root);

  let open = false;
  let updateTimer: ReturnType<typeof setTimeout> | null = null;

  function closePanel(): void {
    if (!open) return;
    open = false;
    root.classList.remove("is-open");
    countBtn.classList.remove("is-active");
    releaseExclusiveLayer(LAYER_ID);
  }

  function openPanel(): void {
    if (open) return;
    open = true;
    root.classList.add("is-open");
    countBtn.classList.add("is-active");
    acquireExclusiveLayer(LAYER_ID, closePanel);
  }

  function refreshToggle(): void {
    includeSymbolsToggle.setChecked(getSettings().wordCount.includeSymbols);
  }

  function refreshLabels(): void {
    scrollTopBtn.title = t("editor.scrollToTop");
    scrollTopBtn.setAttribute("aria-label", t("editor.scrollToTop"));
    scrollBottomBtn.title = t("editor.scrollToBottom");
    scrollBottomBtn.setAttribute("aria-label", t("editor.scrollToBottom"));
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

  scrollTopBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    editor.scrollToTop();
  });

  scrollBottomBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    editor.scrollToBottom();
  });

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (!open) return;
    const target = event.target as Node | null;
    if (target && root.contains(target)) return;
    closePanel();
  };

  const onSelectionChange = () => {
    const active = document.activeElement;
    if (!active || !host.contains(active)) return;
    scheduleUpdate();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) closePanel();
  };

  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("keydown", onKeyDown);
  const unsubscribeLocale = onLocaleChange(() => {
    refreshLabels();
    renderCount();
  });

  refreshLabels();
  refreshToggle();
  renderCount();

  return {
    scheduleUpdate,
    destroy() {
      if (updateTimer != null) clearTimeout(updateTimer);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      unsubscribeLocale();
      closePanel();
      root.remove();
    },
  };
}
