import { describe, expect, test, vi } from "vitest";

import { mountChatView } from "../src/ai/chat-view.ts";
import type { UiChatMessage } from "../src/ai/types.ts";
import {
  acquireExclusiveLayer,
  releaseExclusiveLayer,
} from "../src/ui/exclusive-layer.ts";

function assistant(partial: Partial<UiChatMessage> & Pick<UiChatMessage, "id">): UiChatMessage {
  return {
    kind: "assistant",
    content: "",
    ...partial,
  };
}

describe("chat-view streaming", () => {
  test("patches reasoning in place so the thinking node stays stable", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const chat = mountChatView(host);

    chat.setMessages([
      assistant({
        id: "a1",
        reasoning: "step 1",
        reasoningStreaming: true,
        streaming: true,
      }),
    ]);
    const thinking = host.querySelector(".inimark-ai-thinking");
    const body = host.querySelector(".inimark-ai-thinking-body");
    expect(thinking).toBeTruthy();
    expect(body?.textContent).toBe("step 1");

    chat.setMessages([
      assistant({
        id: "a1",
        reasoning: "step 1\nstep 2",
        reasoningStreaming: true,
        streaming: true,
      }),
    ]);
    expect(host.querySelector(".inimark-ai-thinking")).toBe(thinking);
    expect(host.querySelector(".inimark-ai-thinking-body")).toBe(body);
    expect(body?.textContent).toBe("step 1\nstep 2");

    chat.destroy();
    host.remove();
  });

  test("keeps thinking body scroll when unpinned during stream", () => {
    const host = document.createElement("div");
    // Give the panel a real box so scroll metrics work in happy-dom.
    host.style.height = "400px";
    document.body.append(host);
    const chat = mountChatView(host);

    const long = Array.from({ length: 80 }, (_, i) => `line ${i}`).join("\n");
    chat.setMessages([
      assistant({
        id: "a1",
        reasoning: long,
        reasoningStreaming: true,
        streaming: true,
      }),
    ]);

    const body = host.querySelector<HTMLElement>(".inimark-ai-thinking-body");
    expect(body).toBeTruthy();
    Object.defineProperty(body!, "scrollHeight", { configurable: true, get: () => 800 });
    Object.defineProperty(body!, "clientHeight", { configurable: true, get: () => 160 });
    body!.scrollTop = 0;
    body!.dispatchEvent(new Event("scroll", { bubbles: true }));

    chat.setMessages([
      assistant({
        id: "a1",
        reasoning: `${long}\nline 80`,
        reasoningStreaming: true,
        streaming: true,
      }),
    ]);

    expect(body!.scrollTop).toBe(0);

    chat.destroy();
    host.remove();
  });

  test("does not auto-scroll the list while an exclusive menu is open", () => {
    const host = document.createElement("div");
    host.style.height = "400px";
    document.body.append(host);
    const chat = mountChatView(host);
    const list = host.querySelector<HTMLElement>(".inimark-ai-chat-list")!;

    Object.defineProperty(list, "scrollHeight", { configurable: true, get: () => 2000 });
    Object.defineProperty(list, "clientHeight", { configurable: true, get: () => 400 });
    list.scrollTop = 2000;

    const menu = document.createElement("div");
    acquireExclusiveLayer(menu, () => {});

    const scrollSpy = vi.spyOn(list, "scrollTop", "set");
    chat.setMessages([
      assistant({
        id: "a1",
        content: "hello",
        streaming: true,
      }),
    ]);
    expect(scrollSpy).not.toHaveBeenCalled();

    releaseExclusiveLayer(menu);
    chat.destroy();
    host.remove();
  });

  test("collapses thinking once when reasoning ends, then leaves user toggle alone", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const chat = mountChatView(host);

    chat.setMessages([
      assistant({
        id: "a1",
        reasoning: "think",
        reasoningStreaming: true,
        streaming: true,
      }),
    ]);
    const thinking = host.querySelector<HTMLDetailsElement>(".inimark-ai-thinking")!;
    expect(thinking.open).toBe(true);

    chat.setMessages([
      assistant({
        id: "a1",
        reasoning: "think",
        reasoningStreaming: false,
        content: "answer",
        streaming: true,
      }),
    ]);
    expect(thinking.open).toBe(false);

    thinking.open = true;
    chat.setMessages([
      assistant({
        id: "a1",
        reasoning: "think",
        reasoningStreaming: false,
        content: "answer more",
        streaming: true,
      }),
    ]);
    expect(thinking.open).toBe(true);

    chat.destroy();
    host.remove();
  });
});
