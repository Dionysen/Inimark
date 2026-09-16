import type {
  ChatMessage,
  ChatProvider,
  ChatToolCall,
  ChatStreamEvent,
  WriteUndoEntry,
} from "../types.ts";
import { AGENT_TOOL_DEFINITIONS, buildAgentSystemPrompt } from "./tool-defs.ts";
import { executeAgentTool, type AgentToolHost } from "./tools.ts";

export const DEFAULT_AGENT_MAX_STEPS = 12;

export type AgentLoopEvent =
  | { type: "reasoning_delta"; text: string }
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_done"; content: string }
  | { type: "tool_start"; call: ChatToolCall }
  | { type: "tool_end"; call: ChatToolCall; ok: boolean; output: string }
  | { type: "undo_push"; entry: WriteUndoEntry }
  | { type: "error"; message: string }
  | { type: "done" };

export interface RunAgentLoopOptions {
  provider: ChatProvider;
  model: string;
  /** Prior turns excluding system (system is injected). */
  history: ChatMessage[];
  userContent: string;
  host: AgentToolHost;
  signal: AbortSignal;
  maxSteps?: number;
  /** When false, omit tools (e.g. DeepSeek reasoner). Default true. */
  enableTools?: boolean;
  /**
   * UI language name used when the model cannot infer the user's message language
   * (e.g. "English", "Simplified Chinese (简体中文)").
   */
  fallbackLanguage: string;
  onEvent: (event: AgentLoopEvent) => void;
}

function mergeToolCallDeltas(
  map: Map<number, { id: string; name: string; arguments: string }>,
  event: Extract<ChatStreamEvent, { type: "tool_call_delta" }>,
): void {
  const prev = map.get(event.index) ?? { id: "", name: "", arguments: "" };
  if (event.id) prev.id = event.id;
  if (event.name) prev.name += event.name;
  if (event.argumentsDelta) prev.arguments += event.argumentsDelta;
  map.set(event.index, prev);
}

/**
 * Multi-step tool-calling loop until the model stops requesting tools,
 * max steps, or abort.
 */
export async function runAgentLoop(options: RunAgentLoopOptions): Promise<void> {
  const maxSteps = options.maxSteps ?? DEFAULT_AGENT_MAX_STEPS;
  const enableTools = options.enableTools !== false;
  const messages: ChatMessage[] = [
    { role: "system", content: buildAgentSystemPrompt(options.fallbackLanguage) },
    ...options.history,
    { role: "user", content: options.userContent },
  ];

  for (let step = 0; step < maxSteps; step++) {
    if (options.signal.aborted) {
      options.onEvent({ type: "error", message: "cancelled" });
      return;
    }

    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let assistantText = "";

    try {
      for await (const event of options.provider.streamChat(
        {
          model: options.model,
          messages,
          tools: enableTools ? AGENT_TOOL_DEFINITIONS : undefined,
        },
        options.signal,
      )) {
        if (event.type === "reasoning_delta") {
          options.onEvent({ type: "reasoning_delta", text: event.text });
        } else if (event.type === "text_delta") {
          assistantText += event.text;
          options.onEvent({ type: "assistant_delta", text: event.text });
        } else if (event.type === "tool_call_delta") {
          mergeToolCallDeltas(toolCallMap, event);
        } else if (event.type === "error") {
          options.onEvent({ type: "error", message: event.message });
          return;
        } else if (event.type === "message_end") {
          if (event.message.content) {
            assistantText = event.message.content;
          }
          if (event.message.toolCalls?.length) {
            for (let i = 0; i < event.message.toolCalls.length; i++) {
              const call = event.message.toolCalls[i]!;
              const prev = toolCallMap.get(i) ?? {
                id: call.id,
                name: call.name,
                arguments: call.arguments,
              };
              if (call.id) prev.id = call.id;
              if (call.name) prev.name = call.name;
              if (call.arguments) prev.arguments = call.arguments;
              toolCallMap.set(i, prev);
            }
          }
        }
      }
    } catch (error) {
      if (options.signal.aborted) {
        options.onEvent({ type: "error", message: "cancelled" });
        return;
      }
      options.onEvent({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const toolCalls: ChatToolCall[] = [...toolCallMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        id: v.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        name: v.name,
        arguments: v.arguments || "{}",
      }))
      .filter((c) => c.name);

    options.onEvent({ type: "assistant_done", content: assistantText });

    messages.push({
      role: "assistant",
      content: assistantText || null,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    });

    if (toolCalls.length === 0) {
      options.onEvent({ type: "done" });
      return;
    }

    for (const call of toolCalls) {
      if (options.signal.aborted) {
        options.onEvent({ type: "error", message: "cancelled" });
        return;
      }
      options.onEvent({ type: "tool_start", call });
      const result = await executeAgentTool(call.name, call.arguments, options.host);
      if (result.undo) {
        options.onEvent({ type: "undo_push", entry: result.undo });
      }
      options.onEvent({
        type: "tool_end",
        call,
        ok: result.ok,
        output: result.output,
      });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: result.output,
        name: call.name,
      });
    }
  }

  options.onEvent({
    type: "error",
    message: `Stopped after ${maxSteps} tool steps`,
  });
}
