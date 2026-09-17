import { handleChatLinkClick, hydrateChatRichContent, renderChatMarkdown } from "./markdown-render.ts";
import { formatAnswerAge } from "./relative-time.ts";
import { formatToolCardSummary, isFinalAssistantAnswer } from "./tool-labels.ts";
import type { UiChatMessage } from "./types.ts";
import { t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import { hasExclusiveLayer } from "../ui/exclusive-layer.ts";
import { menuIcons } from "../ui/widgets/menu.ts";
import { bindTooltip } from "../ui/widgets/tooltip.ts";

/** Refresh relative ages without a full message re-render. */
const AGE_TICK_MS = 30_000;

/** px — treat as “at bottom” so tiny layout jitter does not unpin. */
const STICK_THRESHOLD_PX = 48;

export interface ChatViewController {
  el: HTMLElement;
  setMessages(messages: UiChatMessage[]): void;
  /** Pin and jump to the latest content (e.g. after the user sends). */
  scrollToBottom(): void;
  destroy(): void;
}

async function copyPlainText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through */
  }
  if (isTauri()) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  }
}

function isPinnedToBottom(el: HTMLElement, threshold = STICK_THRESHOLD_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function scrollElementToBottom(el: HTMLElement): void {
  el.scrollTop = el.scrollHeight;
}

export function mountChatView(host: HTMLElement): ChatViewController {
  host.className = "inimark-ai-chat";
  host.replaceChildren();

  const list = document.createElement("div");
  list.className = "inimark-ai-chat-list inimark-scrollbar";
  host.append(list);

  list.addEventListener("click", (event) => {
    if (!(event instanceof MouseEvent)) return;
    handleChatLinkClick(event);
  });

  /** When true, growing content keeps the chat list pinned to the latest message. */
  let listPinned = true;
  /** When true, growing reasoning keeps the thinking drawer pinned to its end. */
  let thinkingPinned = true;
  let ageTimer: ReturnType<typeof setInterval> | null = null;
  let renderedIds: string[] = [];

  list.addEventListener(
    "scroll",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === list) {
        listPinned = isPinnedToBottom(list);
        return;
      }
      if (target.classList.contains("inimark-ai-thinking-body")) {
        thinkingPinned = isPinnedToBottom(target);
      }
    },
    true,
  );

  function refreshAges(now: number = Date.now()): void {
    for (const el of list.querySelectorAll<HTMLElement>(".inimark-ai-msg-age")) {
      const raw = el.dataset.endedAt;
      if (!raw) continue;
      const endedAt = Number(raw);
      if (!Number.isFinite(endedAt)) continue;
      el.textContent = formatAnswerAge(endedAt, now);
    }
  }

  function ensureAgeTimer(): void {
    if (ageTimer != null) return;
    ageTimer = setInterval(() => refreshAges(), AGE_TICK_MS);
  }

  function clearAgeTimer(): void {
    if (ageTimer == null) return;
    clearInterval(ageTimer);
    ageTimer = null;
  }

  function syncAgeTimer(): void {
    if (list.querySelector(".inimark-ai-msg-age")) ensureAgeTimer();
    else clearAgeTimer();
  }

  /**
   * Auto-scroll while pinned. Skipped while an exclusive menu is open so
   * programmatic chat scroll does not dismiss the titlebar More / history menus.
   */
  function applyStickyScroll(opts?: { forceList?: boolean; forceThinking?: boolean }): void {
    if (hasExclusiveLayer()) return;

    if (opts?.forceList || listPinned) {
      listPinned = true;
      scrollElementToBottom(list);
    }

    const thinkingBody = list.querySelector<HTMLElement>(
      ".inimark-ai-msg--assistant:last-child .inimark-ai-thinking-body",
    );
    if (thinkingBody && (opts?.forceThinking || thinkingPinned)) {
      thinkingPinned = true;
      scrollElementToBottom(thinkingBody);
    }
  }

  function thinkingShouldOpen(msg: UiChatMessage): boolean {
    return Boolean(msg.reasoningStreaming) || (Boolean(msg.streaming) && !msg.content);
  }

  function ensureThinking(row: HTMLElement, msg: UiChatMessage): void {
    if (!msg.reasoning) {
      row.querySelector(".inimark-ai-thinking")?.remove();
      return;
    }

    let thinking = row.querySelector<HTMLDetailsElement>(":scope > .inimark-ai-thinking");
    if (!thinking) {
      thinking = document.createElement("details");
      thinking.className = "inimark-ai-thinking";
      const summary = document.createElement("summary");
      const body = document.createElement("pre");
      body.className = "inimark-ai-thinking-body inimark-scrollbar";
      thinking.append(summary, body);
      const bubble = row.querySelector(":scope > .inimark-ai-bubble");
      if (bubble) row.insertBefore(thinking, bubble);
      else row.prepend(thinking);
    }

    // Auto-expand while reasoning streams; collapse once when it settles.
    // Do not keep forcing closed afterward — the user may re-open to scroll.
    const autoOpen = thinkingShouldOpen(msg);
    const prevPhase = thinking.dataset.autoPhase;
    const phase = autoOpen ? "reasoning" : "done";
    thinking.dataset.autoPhase = phase;
    if (autoOpen) thinking.open = true;
    else if (prevPhase === "reasoning") thinking.open = false;

    const summary = thinking.querySelector(":scope > summary");
    if (summary) {
      summary.textContent = msg.reasoningStreaming
        ? t("ai.thinkingStreaming")
        : t("ai.thinkingProcess");
    }
    const body = thinking.querySelector<HTMLElement>(":scope > .inimark-ai-thinking-body");
    if (body && body.textContent !== msg.reasoning) {
      body.textContent = msg.reasoning;
    }
  }

  function ensureBubble(row: HTMLElement, msg: UiChatMessage): HTMLElement {
    let bubble = row.querySelector<HTMLElement>(":scope > .inimark-ai-bubble");
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.className = "inimark-ai-bubble";
      row.append(bubble);
    }
    return bubble;
  }

  function syncAssistantBubble(bubble: HTMLElement, msg: UiChatMessage): void {
    if (msg.kind !== "assistant" && msg.kind !== "error") {
      bubble.textContent = msg.content;
      bubble.classList.toggle("is-streaming", Boolean(msg.streaming));
      return;
    }

    if (msg.kind === "assistant" && !msg.content && msg.reasoning) {
      bubble.hidden = true;
      bubble.replaceChildren();
      delete bubble.dataset.md;
      bubble.classList.toggle("is-streaming", Boolean(msg.streaming));
      return;
    }

    bubble.hidden = false;
    const html =
      msg.kind === "error"
        ? renderChatMarkdown(`**${t("ai.error")}:** ${msg.content}`)
        : renderChatMarkdown(msg.content);
    if (bubble.dataset.md !== html) {
      bubble.dataset.md = html;
      bubble.innerHTML = html;
      if (!msg.streaming) void hydrateChatRichContent(bubble);
    }
    bubble.classList.toggle("is-streaming", Boolean(msg.streaming));
  }

  function syncActions(
    row: HTMLElement,
    msg: UiChatMessage,
    index: number,
    messages: UiChatMessage[],
  ): void {
    const want = isFinalAssistantAnswer(messages, index);
    let actions = row.querySelector<HTMLElement>(":scope > .inimark-ai-msg-actions");
    if (!want) {
      actions?.remove();
      return;
    }
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "inimark-ai-msg-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "inimark-ai-copy-btn";
      copyBtn.setAttribute("aria-label", t("ai.copyAnswer"));
      bindTooltip(copyBtn, t("ai.copyAnswer"));
      copyBtn.innerHTML = menuIcons.copy;
      actions.append(copyBtn);
      row.append(actions);
    }

    const copyBtn = actions.querySelector<HTMLButtonElement>(".inimark-ai-copy-btn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        void copyPlainText(msg.content);
      };
    }

    let age = actions.querySelector<HTMLElement>(".inimark-ai-msg-age");
    if (msg.endedAt != null) {
      if (!age) {
        age = document.createElement("time");
        age.className = "inimark-ai-msg-age";
        actions.append(age);
      }
      age.dataset.endedAt = String(msg.endedAt);
      if (age instanceof HTMLTimeElement) {
        age.dateTime = new Date(msg.endedAt).toISOString();
      }
      age.textContent = formatAnswerAge(msg.endedAt);
    } else {
      age?.remove();
    }
  }

  function syncToolRow(row: HTMLElement, msg: UiChatMessage): void {
    if (!msg.tool) return;
    let card = row.querySelector<HTMLDetailsElement>(":scope > .inimark-ai-tool-card");
    if (!card) {
      card = document.createElement("details");
      card.className = "inimark-ai-tool-card";
      const summary = document.createElement("summary");
      const body = document.createElement("pre");
      body.className = "inimark-ai-tool-body";
      card.append(summary, body);
      row.append(card);
    }
    card.open = msg.tool.status === "pending" || msg.tool.status === "error";
    const summary = card.querySelector(":scope > summary");
    if (summary) summary.textContent = formatToolCardSummary(msg.tool);
    const body = card.querySelector(":scope > .inimark-ai-tool-body");
    if (body) {
      body.textContent = [
        msg.tool.argsPreview,
        msg.tool.resultPreview ? `\n---\n${msg.tool.resultPreview}` : "",
      ]
        .join("")
        .trim();
    }
  }

  function syncMessageRow(
    row: HTMLElement,
    msg: UiChatMessage,
    index: number,
    messages: UiChatMessage[],
  ): void {
    row.className = `inimark-ai-msg inimark-ai-msg--${msg.kind}`;
    row.dataset.id = msg.id;

    if (msg.kind === "tool" && msg.tool) {
      row.querySelector(":scope > .inimark-ai-thinking")?.remove();
      row.querySelector(":scope > .inimark-ai-bubble")?.remove();
      row.querySelector(":scope > .inimark-ai-msg-actions")?.remove();
      syncToolRow(row, msg);
      return;
    }

    row.querySelector(":scope > .inimark-ai-tool-card")?.remove();
    ensureThinking(row, msg);
    const bubble = ensureBubble(row, msg);
    syncAssistantBubble(bubble, msg);
    syncActions(row, msg, index, messages);
  }

  function renderMessage(
    msg: UiChatMessage,
    index: number,
    messages: UiChatMessage[],
  ): HTMLElement {
    const row = document.createElement("div");
    syncMessageRow(row, msg, index, messages);
    return row;
  }

  function sameIdSequence(messages: UiChatMessage[]): boolean {
    if (messages.length !== renderedIds.length) return false;
    return messages.every((msg, i) => msg.id === renderedIds[i]);
  }

  function isAppendOnly(messages: UiChatMessage[]): boolean {
    if (messages.length <= renderedIds.length) return false;
    return renderedIds.every((id, i) => id === messages[i]?.id);
  }

  function rebuildAll(messages: UiChatMessage[]): void {
    list.replaceChildren(...messages.map((msg, i) => renderMessage(msg, i, messages)));
  }

  function setMessages(messages: UiChatMessage[]): void {
    if (sameIdSequence(messages)) {
      for (let i = 0; i < messages.length; i++) {
        const row = list.children[i] as HTMLElement | undefined;
        const msg = messages[i]!;
        if (!row) continue;
        syncMessageRow(row, msg, i, messages);
      }
    } else if (isAppendOnly(messages)) {
      for (let i = 0; i < renderedIds.length; i++) {
        const row = list.children[i] as HTMLElement | undefined;
        const msg = messages[i]!;
        if (!row) continue;
        syncMessageRow(row, msg, i, messages);
      }
      for (let i = renderedIds.length; i < messages.length; i++) {
        list.append(renderMessage(messages[i]!, i, messages));
      }
    } else {
      rebuildAll(messages);
      // Fresh transcript (new chat / switch session) — pin to latest.
      listPinned = true;
      thinkingPinned = true;
    }

    renderedIds = messages.map((msg) => msg.id);
    syncAgeTimer();
    applyStickyScroll();
  }

  return {
    el: host,
    setMessages,
    scrollToBottom() {
      listPinned = true;
      thinkingPinned = true;
      applyStickyScroll({ forceList: true, forceThinking: true });
    },
    destroy() {
      clearAgeTimer();
      renderedIds = [];
      host.replaceChildren();
    },
  };
}
