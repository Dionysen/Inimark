import { createIconButton } from "../ui/widgets/index.ts";
import { t } from "../i18n/index.ts";
import type { ChatAttachment } from "./types.ts";

export interface ComposerController {
  el: HTMLElement;
  getText(): string;
  setText(value: string): void;
  getAttachments(): ChatAttachment[];
  setAttachments(items: ChatAttachment[]): void;
  setRunning(running: boolean): void;
  focus(): void;
  destroy(): void;
}

export interface ComposerOptions {
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
  onAddFile: () => void;
  onAddDirectory: () => void;
  onToggleActiveNote: () => void;
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
  const min = Math.ceil(lineHeight + paddingY);
  const max = Math.ceil(lineHeight * maxLines + paddingY);
  const height = Math.min(Math.max(Math.ceil(scrollHeight), min), max);
  return { height, scroll: scrollHeight > max + 0.5 };
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

function noteIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M14 3v6h6"/></svg>`;
}

export function mountComposer(host: HTMLElement, options: ComposerOptions): ComposerController {
  host.className = "inimark-ai-composer";
  host.replaceChildren();

  let attachments: ChatAttachment[] = [];
  let running = false;

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

  const noteBtn = createIconButton({
    label: t("ai.attachActive"),
    title: t("ai.attachActive"),
    onClick: () => options.onToggleActiveNote(),
  });
  noteBtn.innerHTML = noteIcon();

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

  tools.append(attachBtn, folderBtn, noteBtn);
  toolbar.append(tools, sendBtn);

  function syncInputHeight(): void {
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || 18;
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

  function syncChips(): void {
    chips.replaceChildren();
    for (const item of attachments) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "inimark-ai-chip";
      chip.title = item.path || item.label;
      chip.textContent = item.label;
      chip.addEventListener("click", () => options.onRemoveAttachment(item.id));
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

  shell.append(chips, textarea, toolbar);
  host.append(shell);
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
    setRunning(next) {
      running = next;
      syncSend();
    },
    focus() {
      textarea.focus();
    },
    destroy() {
      host.replaceChildren();
    },
  };
}
