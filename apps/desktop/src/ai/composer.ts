import { closeIcon, createIconButton, createMenu } from "../ui/widgets/index.ts";
import { onLocaleChange, t } from "../i18n/index.ts";
import { loadAiPrefs, saveAiPrefs } from "./secrets.ts";
import {
  AI_THINKING_MODES,
  parseAiThinkingMode,
  type AiThinkingMode,
} from "./thinking-mode.ts";
import type { ChatAttachment } from "./types.ts";

export interface ComposerController {
  el: HTMLElement;
  getText(): string;
  setText(value: string): void;
  getAttachments(): ChatAttachment[];
  setAttachments(items: ChatAttachment[]): void;
  getThinkingMode(): AiThinkingMode;
  setRunning(running: boolean): void;
  focus(): void;
  destroy(): void;
}

export interface ComposerOptions {
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
  onAddFile: () => void;
  onAddDirectory: () => void;
  /** Open the attached note / file in the editor. */
  onOpenAttachment: (id: string) => void;
  onRemoveAttachment: (id: string) => void;
}

/** Max visible lines before the immersive input scrolls. */
export const COMPOSER_MAX_LINES = 5;

/**
 * Clamp auto-grow height for the composer textarea.
 * `scrollHeight` is the content height; `lineHeight` / `paddingY` come from computed style.
 */
export function clampComposerInputHeight(
  scrollHeight: number,
  lineHeight: number,
  paddingY: number,
  maxLines: number = COMPOSER_MAX_LINES,
): { height: number; scroll: boolean } {
  const safeLine = Math.max(1, lineHeight);
  const min = Math.ceil(safeLine + paddingY);
  const max = Math.ceil(safeLine * maxLines + paddingY);
  const height = Math.min(Math.max(Math.ceil(scrollHeight), min), max);
  return { height, scroll: scrollHeight > max + 0.5 };
}

/** Resolve used line-box height in px (falls back from font-size when `line-height: normal`). */
export function resolveComposerLineHeightPx(style: CSSStyleDeclaration): number {
  const fontSize = parseFloat(style.fontSize);
  const safeFont = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  const raw = style.lineHeight;
  if (!raw || raw === "normal") return safeFont * 1.5;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : safeFont * 1.5;
}

function paperclipIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m21.44 11.05-8.49 8.49a5.25 5.25 0 0 1-7.43-7.43l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.75 1.75 0 0 1-2.47-2.47l8.49-8.48"/></svg>`;
}

function sendIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 11.25h10.19l-3.72-3.72a.75.75 0 1 1 1.06-1.06l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06l3.72-3.72H5a.75.75 0 0 1 0-1.5z"/></svg>`;
}

function stopIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>`;
}

function folderIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
}

const CHEVRON_DOWN =
  `<svg class="inimark-icon inimark-ai-thinking-mode__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function thinkingModeLabel(mode: AiThinkingMode): string {
  return mode === "deep" ? t("ai.thinkingDeep") : t("ai.thinkingFast");
}

export function mountComposer(host: HTMLElement, options: ComposerOptions): ComposerController {
  host.className = "inimark-ai-composer";
  host.replaceChildren();

  let attachments: ChatAttachment[] = [];
  let running = false;
  let thinkingMode = parseAiThinkingMode(loadAiPrefs().thinkingMode);

  const shell = document.createElement("div");
  shell.className = "inimark-ai-composer-shell";

  const chips = document.createElement("div");
  chips.className = "inimark-ai-chips";

  const textarea = document.createElement("textarea");
  textarea.className = "inimark-ai-input";
  textarea.rows = 1;
  textarea.placeholder = t("ai.placeholder");

  const toolbar = document.createElement("div");
  toolbar.className = "inimark-ai-composer-toolbar";

  const tools = document.createElement("div");
  tools.className = "inimark-ai-composer-tools";

  const attachBtn = createIconButton({
    label: t("ai.attach"),
    title: t("ai.attach"),
    onClick: () => options.onAddFile(),
  });
  attachBtn.innerHTML = paperclipIcon();

  const folderBtn = createIconButton({
    label: t("ai.attachFolder"),
    title: t("ai.attachFolder"),
    onClick: () => options.onAddDirectory(),
  });
  folderBtn.innerHTML = folderIcon();

  const thinkingMenu = createMenu();
  thinkingMenu.el.classList.add("inimark-ai-thinking-mode-menu");

  const thinkingBtn = document.createElement("button");
  thinkingBtn.type = "button";
  thinkingBtn.className = "inimark-control inimark-ai-thinking-mode";
  thinkingBtn.setAttribute("aria-haspopup", "menu");
  thinkingBtn.setAttribute("aria-expanded", "false");

  const thinkingLabel = document.createElement("span");
  thinkingLabel.className = "inimark-ai-thinking-mode__label";

  function syncThinkingButton(): void {
    thinkingLabel.textContent = thinkingModeLabel(thinkingMode);
    thinkingBtn.setAttribute("aria-label", t("ai.thinkingMode"));
    thinkingBtn.title = t("ai.thinkingMode");
  }

  thinkingBtn.append(thinkingLabel);
  thinkingBtn.insertAdjacentHTML("beforeend", CHEVRON_DOWN);
  thinkingMenu.setDismissAnchors([thinkingBtn]);

  function closeThinkingMenu(): void {
    thinkingMenu.setOpen(false);
    thinkingBtn.setAttribute("aria-expanded", "false");
  }

  function persistThinkingMode(mode: AiThinkingMode): void {
    thinkingMode = mode;
    const prefs = loadAiPrefs();
    saveAiPrefs({ ...prefs, thinkingMode: mode });
    syncThinkingButton();
  }

  function positionThinkingMenu(): void {
    const rect = thinkingBtn.getBoundingClientRect();
    const menuWidth = Math.max(148, thinkingMenu.el.offsetWidth || 148);
    const menuHeight = thinkingMenu.el.offsetHeight || 88;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - menuWidth - 8,
    );
    const top = Math.max(8, rect.top - menuHeight - 4);
    thinkingMenu.el.style.top = `${top}px`;
    thinkingMenu.el.style.left = `${left}px`;
    thinkingMenu.el.style.width = `${menuWidth}px`;
  }

  function renderThinkingMenu(): void {
    thinkingMenu.clear();
    thinkingMenu.setPath("");
    thinkingMenu.addHeading(t("ai.thinkingMode"));
    for (const mode of AI_THINKING_MODES) {
      thinkingMenu.addItem({
        label: thinkingModeLabel(mode),
        checked: thinkingMode === mode,
        onClick: () => {
          persistThinkingMode(mode);
          closeThinkingMenu();
        },
      });
    }
  }

  function toggleThinkingMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (thinkingMenu.isOpen()) {
      closeThinkingMenu();
      return;
    }
    renderThinkingMenu();
    thinkingMenu.setOpen(true);
    thinkingBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => positionThinkingMenu());
  }

  thinkingBtn.addEventListener("click", toggleThinkingMenu);

  const sendBtn = createIconButton({
    label: t("ai.send"),
    title: t("ai.send"),
    onClick: () => {
      if (running) {
        options.onStop();
        return;
      }
      const text = textarea.value.trim();
      if (!text) return;
      options.onSend(text, [...attachments]);
    },
  });
  sendBtn.innerHTML = sendIcon();
  sendBtn.classList.add("inimark-ai-send");

  tools.append(attachBtn, folderBtn, thinkingBtn);
  toolbar.append(tools, sendBtn);

  function syncInputHeight(): void {
    const style = getComputedStyle(textarea);
    const lineHeight = resolveComposerLineHeightPx(style);
    const paddingY =
      (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    textarea.style.height = "0px";
    const { height, scroll } = clampComposerInputHeight(
      textarea.scrollHeight,
      lineHeight,
      paddingY,
    );
    textarea.style.height = `${height}px`;
    textarea.style.overflowY = scroll ? "auto" : "hidden";
  }

  // Re-measure when settings change editor font-size / line-height CSS vars.
  const fontObserver = new MutationObserver(() => syncInputHeight());
  fontObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });

  function syncChips(): void {
    chips.replaceChildren();
    for (const item of attachments) {
      const chip = document.createElement("div");
      chip.className = "inimark-ai-chip";
      chip.dataset.kind = item.kind;

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "inimark-ai-chip__label";
      openBtn.title = item.path || item.label;
      openBtn.textContent = item.label;
      openBtn.addEventListener("click", () => options.onOpenAttachment(item.id));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "inimark-ai-chip__remove";
      removeBtn.setAttribute("aria-label", t("ai.removeAttachment"));
      removeBtn.title = t("ai.removeAttachment");
      removeBtn.innerHTML = closeIcon();
      removeBtn.addEventListener("click", () => options.onRemoveAttachment(item.id));

      chip.append(openBtn, removeBtn);
      chips.append(chip);
    }
    chips.hidden = attachments.length === 0;
  }

  function syncSend(): void {
    sendBtn.innerHTML = running ? stopIcon() : sendIcon();
    sendBtn.title = running ? t("ai.stop") : t("ai.send");
    sendBtn.setAttribute("aria-label", sendBtn.title);
    sendBtn.classList.toggle("is-running", running);
    const empty = !textarea.value.trim();
    sendBtn.classList.toggle("is-empty", empty && !running);
    sendBtn.disabled = running ? false : empty;
    textarea.disabled = running;
    thinkingBtn.disabled = running;
  }

  textarea.addEventListener("input", () => {
    syncInputHeight();
    syncSend();
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!running && !sendBtn.disabled) sendBtn.click();
    }
  });

  shell.addEventListener("mousedown", (event) => {
    if (event.target === shell || event.target === toolbar || event.target === tools) {
      event.preventDefault();
      textarea.focus();
    }
  });

  function onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && thinkingMenu.isOpen()) closeThinkingMenu();
  }
  document.addEventListener("keydown", onDocumentKeydown);

  const unsubLocale = onLocaleChange(() => {
    textarea.placeholder = t("ai.placeholder");
    attachBtn.title = t("ai.attach");
    attachBtn.setAttribute("aria-label", t("ai.attach"));
    folderBtn.title = t("ai.attachFolder");
    folderBtn.setAttribute("aria-label", t("ai.attachFolder"));
    syncThinkingButton();
    syncSend();
    if (thinkingMenu.isOpen()) renderThinkingMenu();
  });

  shell.append(chips, textarea, toolbar);
  host.append(shell, thinkingMenu.el);
  syncThinkingButton();
  syncChips();
  syncSend();
  syncInputHeight();

  return {
    el: host,
    getText: () => textarea.value,
    setText(value) {
      textarea.value = value;
      syncInputHeight();
      syncSend();
    },
    getAttachments: () => [...attachments],
    setAttachments(items) {
      attachments = [...items];
      syncChips();
    },
    getThinkingMode: () => thinkingMode,
    setRunning(next) {
      running = next;
      syncSend();
    },
    focus() {
      textarea.focus();
    },
    destroy() {
      fontObserver.disconnect();
      document.removeEventListener("keydown", onDocumentKeydown);
      unsubLocale();
      closeThinkingMenu();
      thinkingMenu.destroy();
      host.replaceChildren();
    },
  };
}
