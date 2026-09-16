import { renderChatMarkdown } from "./markdown-render.ts";
import type { UiChatMessage } from "./types.ts";
import { t } from "../i18n/index.ts";

export interface ChatViewController {
  el: HTMLElement;
  setMessages(messages: UiChatMessage[]): void;
  scrollToBottom(): void;
  destroy(): void;
}

export function mountChatView(host: HTMLElement): ChatViewController {
  host.className = "inimark-ai-chat";
  host.replaceChildren();

  const list = document.createElement("div");
  list.className = "inimark-ai-chat-list inimark-scrollbar";
  host.append(list);

  function renderMessage(msg: UiChatMessage): HTMLElement {
    const row = document.createElement("div");
    row.className = `inimark-ai-msg inimark-ai-msg--${msg.kind}`;
    row.dataset.id = msg.id;

    if (msg.kind === "tool" && msg.tool) {
      const card = document.createElement("details");
      card.className = "inimark-ai-tool-card";
      card.open = msg.tool.status === "pending" || msg.tool.status === "error";
      const summary = document.createElement("summary");
      summary.textContent = `${msg.tool.name} · ${msg.tool.status}`;
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
    return row;
  }

  return {
    el: host,
    setMessages(messages) {
      list.replaceChildren(...messages.map(renderMessage));
    },
    scrollToBottom() {
      list.scrollTop = list.scrollHeight;
    },
    destroy() {
      host.replaceChildren();
    },
  };
}
