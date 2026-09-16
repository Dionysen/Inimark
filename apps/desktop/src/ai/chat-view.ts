import { handleChatLinkClick, hydrateChatRichContent, renderChatMarkdown } from "./markdown-render.ts";
import { formatAnswerAge } from "./relative-time.ts";
import { formatToolCardSummary, isFinalAssistantAnswer } from "./tool-labels.ts";
import type { UiChatMessage } from "./types.ts";
import { t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import { menuIcons } from "../ui/widgets/menu.ts";
import { bindTooltip } from "../ui/widgets/tooltip.ts";

/** Refresh relative ages without a full message re-render. */
const AGE_TICK_MS = 30_000;

export interface ChatViewController {
  el: HTMLElement;
  setMessages(messages: UiChatMessage[]): void;
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

  let ageTimer: ReturnType<typeof setInterval> | null = null;

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

  function renderMessage(msg: UiChatMessage, index: number, messages: UiChatMessage[]): HTMLElement {
    const row = document.createElement("div");
    row.className = `inimark-ai-msg inimark-ai-msg--${msg.kind}`;
    row.dataset.id = msg.id;

    if (msg.kind === "tool" && msg.tool) {
      const card = document.createElement("details");
      card.className = "inimark-ai-tool-card";
      card.open = msg.tool.status === "pending" || msg.tool.status === "error";
      const summary = document.createElement("summary");
      summary.textContent = formatToolCardSummary(msg.tool);
      const body = document.createElement("pre");
      body.className = "inimark-ai-tool-body";
      body.textContent = [
        msg.tool.argsPreview,
        msg.tool.resultPreview ? `\n---\n${msg.tool.resultPreview}` : "",
      ]
        .join("")
        .trim();
      card.append(summary, body);
      row.append(card);
      return row;
    }

    if (msg.kind === "assistant" && msg.reasoning) {
      const thinking = document.createElement("details");
      thinking.className = "inimark-ai-thinking";
      // Expand while reasoning streams; collapse once the answer settles.
      thinking.open = Boolean(msg.reasoningStreaming) || (Boolean(msg.streaming) && !msg.content);
      const summary = document.createElement("summary");
      summary.textContent = msg.reasoningStreaming
        ? t("ai.thinkingStreaming")
        : t("ai.thinkingProcess");
      const body = document.createElement("pre");
      body.className = "inimark-ai-thinking-body";
      body.textContent = msg.reasoning;
      thinking.append(summary, body);
      row.append(thinking);
    }

    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    if (msg.kind === "assistant" || msg.kind === "error") {
      if (msg.kind === "assistant" && !msg.content && msg.reasoning) {
        // Reasoning-only phase — keep an empty bubble hidden until answer text arrives.
        bubble.hidden = true;
      } else {
        bubble.innerHTML = renderChatMarkdown(
          msg.kind === "error" ? `**${t("ai.error")}:** ${msg.content}` : msg.content,
        );
        // Mermaid + syntax highlight are async; hydrate only after the stream settles.
        if (!msg.streaming) void hydrateChatRichContent(bubble);
      }
    } else {
      bubble.textContent = msg.content;
    }
    if (msg.streaming) bubble.classList.add("is-streaming");
    row.append(bubble);

    // Copy + age only on the final answer of a turn — not tool cards or earlier fragments.
    if (isFinalAssistantAnswer(messages, index)) {
      const actions = document.createElement("div");
      actions.className = "inimark-ai-msg-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "inimark-ai-copy-btn";
      copyBtn.setAttribute("aria-label", t("ai.copyAnswer"));
      bindTooltip(copyBtn, t("ai.copyAnswer"));
      copyBtn.innerHTML = menuIcons.copy;
      copyBtn.addEventListener("click", () => {
        void copyPlainText(msg.content);
      });
      actions.append(copyBtn);
      if (msg.endedAt != null) {
        const age = document.createElement("time");
        age.className = "inimark-ai-msg-age";
        age.dataset.endedAt = String(msg.endedAt);
        age.dateTime = new Date(msg.endedAt).toISOString();
        age.textContent = formatAnswerAge(msg.endedAt);
        actions.append(age);
      }
      row.append(actions);
    }

    return row;
  }

  return {
    el: host,
    setMessages(messages) {
      list.replaceChildren(...messages.map((msg, i) => renderMessage(msg, i, messages)));
      if (list.querySelector(".inimark-ai-msg-age")) ensureAgeTimer();
      else clearAgeTimer();
    },
    scrollToBottom() {
      list.scrollTop = list.scrollHeight;
    },
    destroy() {
      clearAgeTimer();
      host.replaceChildren();
    },
  };
}
