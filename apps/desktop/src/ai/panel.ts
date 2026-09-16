import { onLocaleChange, t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import type { Workspace, WorkspaceTreeNode } from "../platform/types.ts";
import {
  readWorkspaceFile,
  writeWorkspaceFile,
} from "../platform/workspace.ts";
import { searchVaultIncremental } from "../sidebar/vault-search.ts";
import { createIconButton } from "../ui/widgets/index.ts";
import { runAgentLoop, type AgentLoopEvent } from "./agent/loop.ts";
import {
  formatDirectoryListing,
  packAttachmentContext,
  type AttachmentContent,
} from "./agent/context.ts";
import type { AgentToolHost } from "./agent/tools.ts";
import { mountChatView, type ChatViewController } from "./chat-view.ts";
import { mountComposer, type ComposerController } from "./composer.ts";
import { createOpenAiCompatProvider } from "./providers/openai-compat.ts";
import { loadAiPrefs, loadAiSecrets } from "./secrets.ts";
import type {
  ChatAttachment,
  ChatMessage,
  UiChatMessage,
  WriteUndoEntry,
} from "./types.ts";

export interface AiPanelHost {
  getWorkspace(): Workspace | null;
  getActiveFilePath(): string | null;
  getActiveMarkdown(): string;
  openNote(path: string): Promise<void>;
  onFileWritten(path: string, content: string): void;
}

export interface AiPanelController {
  el: HTMLElement;
  focusComposer(): void;
  newChat(): void;
  setHost(host: AiPanelHost): void;
  destroy(): void;
}

function newId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findNode(
  nodes: WorkspaceTreeNode[],
  path: string,
): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const hit = findNode(node.children, path);
      if (hit) return hit;
    }
  }
  return null;
}

function flattenDir(
  node: WorkspaceTreeNode,
  out: Array<{ name: string; kind: "file" | "directory"; path: string }> = [],
): Array<{ name: string; kind: "file" | "directory"; path: string }> {
  if (!node.children) return out;
  for (const child of node.children) {
    out.push({ name: child.name, kind: child.kind, path: child.path });
  }
  return out;
}

export function mountAiPanel(hostEl: HTMLElement): AiPanelController {
  hostEl.className = "inimark-sidebar-panel inimark-ai-panel";
  hostEl.dataset.panel = "ai";
  hostEl.setAttribute("role", "tabpanel");
  hostEl.replaceChildren();

  let panelHost: AiPanelHost | null = null;
  let uiMessages: UiChatMessage[] = [];
  let history: ChatMessage[] = [];
  let attachments: ChatAttachment[] = [];
  let undoStack: WriteUndoEntry[] = [];
  let abort: AbortController | null = null;
  let running = false;

  const toolbar = document.createElement("div");
  toolbar.className = "inimark-ai-toolbar";

  const title = document.createElement("div");
  title.className = "inimark-ai-title";
  title.textContent = t("ai.title");

  const newBtn = createIconButton({
    label: t("ai.newChat"),
    title: t("ai.newChat"),
    onClick: () => newChat(),
  });
  newBtn.textContent = "+";

  const undoBtn = createIconButton({
    label: t("ai.undoWrite"),
    title: t("ai.undoWrite"),
    onClick: () => void undoLastWrite(),
  });
  undoBtn.textContent = "↶";

  toolbar.append(title, undoBtn, newBtn);

  const chatHost = document.createElement("div");
  const chat: ChatViewController = mountChatView(chatHost);

  const composerHost = document.createElement("div");
  const composer: ComposerController = mountComposer(composerHost, {
    onSend: (text, atts) => void send(text, atts),
    onStop: () => stop(),
    onAddFile: () => void addFileAttachment(),
    onAddDirectory: () => void addDirectoryAttachment(),
    onToggleActiveNote: () => toggleActiveNoteAttachment(),
    onRemoveAttachment: (id) => {
      attachments = attachments.filter((a) => a.id !== id);
      composer.setAttachments(attachments);
    },
  });

  hostEl.append(toolbar, chatHost, composerHost);

  function refreshChat(): void {
    chat.setMessages(uiMessages);
    chat.scrollToBottom();
    undoBtn.disabled = undoStack.length === 0;
  }

  function newChat(): void {
    stop();
    uiMessages = [];
    history = [];
    undoStack = [];
    refreshChat();
  }

  function stop(): void {
    abort?.abort();
    abort = null;
    running = false;
    composer.setRunning(false);
    for (const msg of uiMessages) {
      if (msg.streaming) msg.streaming = false;
    }
    refreshChat();
  }

  async function undoLastWrite(): Promise<void> {
    const entry = undoStack.pop();
    if (!entry || !panelHost) {
      refreshChat();
      return;
    }
    const workspace = panelHost.getWorkspace();
    if (!workspace) return;
    await writeWorkspaceFile(workspace, entry.path, entry.before);
    panelHost.onFileWritten(entry.path, entry.before);
    uiMessages.push({
      id: newId(),
      kind: "assistant",
      content: t("ai.undoDone", { path: entry.path }),
    });
    refreshChat();
  }

  function toggleActiveNoteAttachment(): void {
    const existing = attachments.find((a) => a.kind === "active-note");
    if (existing) {
      attachments = attachments.filter((a) => a.id !== existing.id);
    } else {
      const path = panelHost?.getActiveFilePath() ?? "";
      attachments.push({
        id: newId(),
        kind: "active-note",
        path,
        label: path ? path.split("/").pop()! : t("ai.activeNote"),
      });
    }
    composer.setAttachments(attachments);
  }

  async function addFileAttachment(): Promise<void> {
    if (!isTauri() || !panelHost?.getWorkspace()) return;
    const workspace = panelHost.getWorkspace()!;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({
      multiple: false,
      directory: false,
      defaultPath: workspace.rootPath,
    });
    if (!picked || typeof picked !== "string") return;
    const root = workspace.rootPath.replace(/\\/g, "/");
    const full = picked.replace(/\\/g, "/");
    if (!full.startsWith(root)) return;
    let rel = full.slice(root.length);
    if (rel.startsWith("/")) rel = rel.slice(1);
    attachments.push({
      id: newId(),
      kind: "file",
      path: rel,
      label: rel.split("/").pop() || rel,
    });
    composer.setAttachments(attachments);
  }

  async function addDirectoryAttachment(): Promise<void> {
    if (!isTauri() || !panelHost?.getWorkspace()) return;
    const workspace = panelHost.getWorkspace()!;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({
      multiple: false,
      directory: true,
      defaultPath: workspace.rootPath,
    });
    if (!picked || typeof picked !== "string") return;
    const root = workspace.rootPath.replace(/\\/g, "/");
    const full = picked.replace(/\\/g, "/");
    if (!full.startsWith(root)) return;
    let rel = full.slice(root.length);
    if (rel.startsWith("/")) rel = rel.slice(1);
    attachments.push({
      id: newId(),
      kind: "directory",
      path: rel,
      label: `${rel.split("/").pop() || rel}/`,
    });
    composer.setAttachments(attachments);
  }

  async function loadAttachmentContents(
    items: ChatAttachment[],
  ): Promise<AttachmentContent[]> {
    const workspace = panelHost?.getWorkspace();
    const out: AttachmentContent[] = [];
    for (const item of items) {
      if (item.kind === "active-note") {
        out.push({
          attachment: {
            ...item,
            path: panelHost?.getActiveFilePath() ?? item.path,
          },
          content: panelHost?.getActiveMarkdown() ?? "",
        });
        continue;
      }
      if (!workspace) continue;
      if (item.kind === "file") {
        const opened = await readWorkspaceFile(workspace, item.path);
        out.push({
          attachment: item,
          content:
            opened.status === "opened"
              ? opened.text
              : `Error: ${opened.status === "error" ? opened.message : "unknown"}`,
        });
        continue;
      }
      if (item.kind === "directory") {
        const node =
          item.path === ""
            ? ({
                name: "",
                path: "",
                kind: "directory",
                children: workspace.tree,
              } as WorkspaceTreeNode)
            : findNode(workspace.tree, item.path);
        const entries = node ? flattenDir(node) : [];
        out.push({
          attachment: item,
          content: formatDirectoryListing(entries),
        });
      }
    }
    return out;
  }

  function createToolHost(): AgentToolHost {
    return {
      getActiveNote() {
        const path = panelHost?.getActiveFilePath() ?? null;
        return { path, content: panelHost?.getActiveMarkdown() ?? "" };
      },
      async readFile(path) {
        const workspace = panelHost?.getWorkspace();
        if (!workspace) throw new Error("No workspace open");
        const opened = await readWorkspaceFile(workspace, path);
        if (opened.status !== "opened") {
          throw new Error(opened.status === "error" ? opened.message : "read failed");
        }
        return opened.text;
      },
      async listDir(path) {
        const workspace = panelHost?.getWorkspace();
        if (!workspace) throw new Error("No workspace open");
        const node =
          path === ""
            ? ({
                name: "",
                path: "",
                kind: "directory",
                children: workspace.tree,
              } as WorkspaceTreeNode)
            : findNode(workspace.tree, path);
        if (!node) throw new Error(`Directory not found: ${path}`);
        return flattenDir(node);
      },
      async searchVault(query) {
        const workspace = panelHost?.getWorkspace();
        if (!workspace) throw new Error("No workspace open");
        const results = await searchVaultIncremental(
          workspace,
          query,
          () => {},
          { cancelled: false },
        );
        return results.slice(0, 30).map((r) => ({
          path: r.path,
          fileName: r.fileName,
          nameMatch: r.nameMatch,
          preview: r.matches.map((m) => `L${m.line}: ${m.content}`).join(" | "),
        }));
      },
      async writeFile(path, content) {
        const workspace = panelHost?.getWorkspace();
        if (!workspace) throw new Error("No workspace open");
        const result = await writeWorkspaceFile(workspace, path, content);
        if (result.status === "error") throw new Error(result.message);
      },
      async openNote(path) {
        await panelHost?.openNote(path);
      },
      onFileWritten(path, content) {
        panelHost?.onFileWritten(path, content);
      },
    };
  }

  function handleLoopEvent(event: AgentLoopEvent): void {
    if (event.type === "assistant_delta") {
      const last = uiMessages[uiMessages.length - 1];
      if (last?.kind === "assistant" && last.streaming) {
        last.content += event.text;
      } else {
        uiMessages.push({
          id: newId(),
          kind: "assistant",
          content: event.text,
          streaming: true,
        });
      }
      refreshChat();
      return;
    }
    if (event.type === "assistant_done") {
      const last = uiMessages[uiMessages.length - 1];
      if (last?.kind === "assistant") {
        last.streaming = false;
        if (event.content) last.content = event.content;
      } else if (event.content) {
        uiMessages.push({ id: newId(), kind: "assistant", content: event.content });
      }
      refreshChat();
      return;
    }
    if (event.type === "tool_start") {
      uiMessages.push({
        id: newId(),
        kind: "tool",
        content: "",
        tool: {
          id: event.call.id,
          name: event.call.name,
          argsPreview: event.call.arguments.slice(0, 500),
          status: "pending",
        },
      });
      refreshChat();
      return;
    }
    if (event.type === "tool_end") {
      const card = [...uiMessages]
        .reverse()
        .find((m) => m.tool?.id === event.call.id);
      if (card?.tool) {
        card.tool.status = event.ok ? "done" : "error";
        card.tool.resultPreview = event.output.slice(0, 800);
      }
      refreshChat();
      return;
    }
    if (event.type === "undo_push") {
      undoStack.push(event.entry);
      refreshChat();
      return;
    }
    if (event.type === "error") {
      if (event.message !== "cancelled") {
        uiMessages.push({ id: newId(), kind: "error", content: event.message });
      }
      refreshChat();
      return;
    }
  }

  async function send(text: string, atts: ChatAttachment[]): Promise<void> {
    if (running) return;
    const secrets = loadAiSecrets();
    const prefs = loadAiPrefs();
    if (!secrets.apiKey.trim()) {
      uiMessages.push({
        id: newId(),
        kind: "error",
        content: t("ai.missingKey"),
      });
      refreshChat();
      return;
    }

    const prefsAtts = [...atts];
    if (
      prefs.attachActiveNote &&
      !prefsAtts.some((a) => a.kind === "active-note") &&
      panelHost?.getActiveFilePath()
    ) {
      const path = panelHost.getActiveFilePath()!;
      prefsAtts.push({
        id: newId(),
        kind: "active-note",
        path,
        label: path.split("/").pop() || path,
      });
    }

    const packed = packAttachmentContext(await loadAttachmentContents(prefsAtts));
    const userContent = packed.text
      ? `${text}\n\n---\nAttached context:\n\n${packed.text}`
      : text;

    uiMessages.push({ id: newId(), kind: "user", content: text });
    history.push({ role: "user", content: userContent });
    composer.setText("");
    attachments = [];
    composer.setAttachments(attachments);
    refreshChat();

    running = true;
    composer.setRunning(true);
    abort = new AbortController();

    const provider = createOpenAiCompatProvider({
      id: prefs.providerId,
      baseUrl: prefs.baseUrl,
      apiKey: secrets.apiKey,
      useSystemProxy: prefs.useSystemProxy,
    });

    const prior = history.slice(0, -1);

    await runAgentLoop({
      provider,
      model: prefs.model,
      history: prior,
      userContent,
      host: createToolHost(),
      signal: abort.signal,
      onEvent: handleLoopEvent,
    });

    // Persist assistant turn(s) already reflected in UI into history for multi-turn.
    const lastAssistant = [...uiMessages].reverse().find((m) => m.kind === "assistant");
    if (lastAssistant?.content) {
      // history already has the user message; append final assistant text only
      // Tool transcripts stay inside the loop's message list for the request;
      // for follow-ups we keep a simplified history of user + last assistant.
      history.push({ role: "assistant", content: lastAssistant.content });
    }

    running = false;
    composer.setRunning(false);
    abort = null;
    refreshChat();
  }

  const unsubLocale = onLocaleChange(() => {
    title.textContent = t("ai.title");
    newBtn.title = t("ai.newChat");
    undoBtn.title = t("ai.undoWrite");
  });

  // Default: offer active note chip when prefs say so (visual only until send).
  const prefs = loadAiPrefs();
  if (prefs.attachActiveNote) {
    toggleActiveNoteAttachment();
  }

  return {
    el: hostEl,
    focusComposer() {
      composer.focus();
    },
    newChat,
    setHost(next) {
      panelHost = next;
    },
    destroy() {
      stop();
      unsubLocale();
      chat.destroy();
      composer.destroy();
      hostEl.replaceChildren();
    },
  };
}
