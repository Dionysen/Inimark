import { renderChatMarkdown } from "./markdown-render.ts";
import { formatToolCardSummary, isFinalAssistantAnswer } from "./tool-labels.ts";
import type { UiChatMessage } from "./types.ts";
import { t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import { menuIcons } from "../ui/widgets/menu.ts";
import { bindTooltip } from "../ui/widgets/tooltip.ts";

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

    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    if (msg.kind === "assistant" || msg.kind === "error") {
      bubble.innerHTML = renderChatMarkdown(
        msg.kind === "error" ? `**${t("ai.error")}:** ${msg.content}` : msg.content,
      );
    } else {
      bubble.textContent = msg.content;
    }
    if (msg.streaming) bubble.classList.add("is-streaming");
    row.append(bubble);

    // Copy only the final answer of a turn — not tool cards or earlier assistant fragments.
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
      row.append(actions);
    }

    return row;
  }

  return {
    el: host,
    setMessages(messages) {
      list.replaceChildren(...messages.map((msg, i) => renderMessage(msg, i, messages)));
    },
    scrollToBottom() {
      list.scrollTop = list.scrollHeight;
    },
    destroy() {
      host.replaceChildren();
    },
  };
}
