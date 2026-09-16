import { onLocaleChange, getLocale, t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import type { Workspace, WorkspaceTreeNode } from "../platform/types.ts";
import {
  readWorkspaceFile,
  writeWorkspaceFile,
} from "../platform/workspace.ts";
import { searchVaultIncremental } from "../sidebar/vault-search.ts";
import {
  chatHistoryIcon,
  closeIcon,
  createMenu,
  createPanelToolbar,
  newChatIcon,
  undoWriteIcon,
} from "../ui/widgets/index.ts";
import {
  AI_CHAT_HISTORY_MAX,
  createAiChatSession,
  deleteAiChatSession,
  previewFromUiMessages,
  sessionHasContent,
  titleFromFirstUserMessage,
  upsertAiChatSession,
  wouldEvictAiChatSession,
  type AiChatSession,
} from "./chat-history.ts";
import { runAgentLoop, type AgentLoopEvent } from "./agent/loop.ts";
import { promptConfirm } from "../ui/confirm-dialog.ts";
import {
  getWorkspaceAiChatSessions,
  setWorkspaceAiChatSessions,
} from "../workspace/runtime.ts";
import { agentFallbackLanguageLabel } from "./agent/tool-defs.ts";
import {
  formatDirectoryListing,
  formatUserTurnWithAttachments,
  packAttachmentContext,
  type AttachmentContent,
} from "./agent/context.ts";
import type { AgentToolHost } from "./agent/tools.ts";
import { resolveSendAttachments, mergeVaultPathAttachments } from "./attachments.ts";
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
import { registerVaultPathDropTarget } from "../platform/vault-path-drop.ts";

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
  /** Write the open chat into the bound library’s history (before vault flush). */
  persistActiveSession(): void;
  /** Reload chat history after the bound library changes. */
  syncWorkspace(): void;
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
  let sessions: AiChatSession[] = [];
  let currentSessionId: string | null = null;

  const historyMenu = createMenu();
  historyMenu.el.classList.add("inimark-ai-history-menu");

  const toolbar = createPanelToolbar([
    {
      label: t("ai.history"),
      title: t("ai.history"),
      icon: chatHistoryIcon,
      onClick: () => toggleHistoryMenu(),
    },
    {
      label: t("ai.undoWrite"),
      title: t("ai.undoWrite"),
      icon: undoWriteIcon,
      onClick: () => void undoLastWrite(),
      disabled: true,
    },
    {
      label: t("ai.newChat"),
      title: t("ai.newChat"),
      icon: newChatIcon,
      onClick: () => newChat(),
    },
  ]);
  const historyBtn = toolbar.buttons[0]!;
  const undoBtn = toolbar.buttons[1]!;
  const newBtn = toolbar.buttons[2]!;
  historyBtn.setAttribute("aria-haspopup", "menu");
  historyBtn.setAttribute("aria-expanded", "false");
  historyMenu.setDismissAnchors([historyBtn]);

  const chatHost = document.createElement("div");
  const chat: ChatViewController = mountChatView(chatHost);

  const composerHost = document.createElement("div");
  const composer: ComposerController = mountComposer(composerHost, {
    onSend: (text, atts) => void send(text, atts),
    onStop: () => stop(),
    onAddFile: () => void addFileAttachment(),
    onAddDirectory: () => void addDirectoryAttachment(),
    onOpenAttachment: (id) => void openAttachment(id),
    onRemoveAttachment: (id) => {
      attachments = attachments.filter((a) => a.id !== id);
      composer.setAttachments(attachments);
    },
  });

  hostEl.append(toolbar.el, chatHost, composerHost, historyMenu.el);

  function attachVaultPaths(
    items: readonly Array<{ path: string; kind: "file" | "directory" }>,
  ): void {
    attachments = mergeVaultPathAttachments(attachments, items, newId);
    composer.setAttachments(attachments);
  }

  const unregisterVaultDrop = registerVaultPathDropTarget(composerHost, (items) => {
    attachVaultPaths(items);
  });

  function refreshChat(): void {
    chat.setMessages(uiMessages);
    chat.scrollToBottom();
    undoBtn.disabled = undoStack.length === 0;
  }

  function reloadSessionsFromWorkspace(): void {
    const fromWs = getWorkspaceAiChatSessions();
    sessions = fromWs ? structuredClone(fromWs) : [];
  }

  function commitSessions(next: AiChatSession[]): void {
    sessions = next;
    setWorkspaceAiChatSessions(sessions);
  }

  function persistCurrentSession(): void {
    if (!currentSessionId) return;
    const existing = sessions.find((s) => s.id === currentSessionId);
    if (!existing) return;
    const next: AiChatSession = {
      ...existing,
      uiMessages: structuredClone(uiMessages),
      history: structuredClone(history),
      preview: previewFromUiMessages(uiMessages),
      updatedAt: Date.now(),
    };
    if (!sessionHasContent(next)) return;
    commitSessions(upsertAiChatSession(sessions, next));
  }

  async function confirmHistoryEviction(): Promise<boolean> {
    return promptConfirm({
      title: t("ai.historyLimitTitle"),
      message: t("ai.historyLimitMessage", { max: AI_CHAT_HISTORY_MAX }),
      confirmLabel: t("ai.historyLimitConfirm"),
      cancelLabel: t("ai.historyLimitCancel"),
    });
  }

  /**
   * First user message of a draft chat → create a stored session + title.
   * Caller must confirm eviction when `wouldEvictAiChatSession` is true.
   */
  function ensureSessionForFirstMessage(userText: string): void {
    if (currentSessionId) return;
    const draft = createAiChatSession({
      title: titleFromFirstUserMessage(userText, t("ai.untitledChat")),
      uiMessages,
      history,
    });
    currentSessionId = draft.id;
    commitSessions(upsertAiChatSession(sessions, draft));
  }

  function clearDraftChat(): void {
    currentSessionId = null;
    uiMessages = [];
    history = [];
    undoStack = [];
    attachments = [];
    composer.setAttachments(attachments);
    refreshChat();
  }

  function syncWorkspace(): void {
    abort?.abort();
    abort = null;
    running = false;
    composer.setRunning(false);
    closeHistoryMenu();
    clearDraftChat();
    reloadSessionsFromWorkspace();
  }

  function newChat(): void {
    stop();
    closeHistoryMenu();
    persistCurrentSession();
    clearDraftChat();
  }

  function openSession(id: string): void {
    if (id === currentSessionId) {
      closeHistoryMenu();
      return;
    }
    stop();
    persistCurrentSession();
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    currentSessionId = session.id;
    uiMessages = structuredClone(session.uiMessages);
    history = structuredClone(session.history);
    undoStack = [];
    attachments = [];
    composer.setAttachments(attachments);
    refreshChat();
    closeHistoryMenu();
  }

  function removeSession(id: string): void {
    commitSessions(deleteAiChatSession(sessions, id));
    if (currentSessionId === id) {
      stop();
      clearDraftChat();
    }
    if (historyMenu.isOpen()) renderHistoryMenu();
  }

  function closeHistoryMenu(): void {
    historyMenu.setOpen(false);
    historyBtn.setAttribute("aria-expanded", "false");
  }

  function positionHistoryMenu(): void {
    const rect = historyBtn.getBoundingClientRect();
    const menuWidth = Math.max(240, Math.min(320, hostEl.getBoundingClientRect().width - 16));
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - menuWidth / 2),
      window.innerWidth - menuWidth - 8,
    );
    historyMenu.el.style.top = `${rect.bottom + 4}px`;
    historyMenu.el.style.left = `${left}px`;
    historyMenu.el.style.width = `${menuWidth}px`;
  }

  function renderHistoryMenu(): void {
    historyMenu.clear();
    historyMenu.setPath("");
    historyMenu.addHeading(t("ai.history"));
    if (sessions.length === 0) {
      historyMenu.setEmpty(t("ai.historyEmpty"));
      return;
    }
    for (const session of sessions) {
      historyMenu.addItem({
        label: session.title || t("ai.untitledChat"),
        meta: session.preview || undefined,
        metaPlacement: "below",
        selected: session.id === currentSessionId,
        title: session.title,
        onClick: () => openSession(session.id),
        trailingAction: {
          icon: closeIcon(),
          title: t("ai.historyDelete"),
          onClick: () => removeSession(session.id),
        },
      });
    }
  }

  function toggleHistoryMenu(): void {
    if (historyMenu.isOpen()) {
      closeHistoryMenu();
      return;
    }
    reloadSessionsFromWorkspace();
    renderHistoryMenu();
    historyMenu.setOpen(true);
    historyBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => positionHistoryMenu());
  }

  function onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && historyMenu.isOpen()) closeHistoryMenu();
  }

  document.addEventListener("keydown", onDocumentKeydown);

  function stop(): void {
    abort?.abort();
    abort = null;
    running = false;
    composer.setRunning(false);
    const now = Date.now();
    for (const msg of uiMessages) {
      if (msg.streaming) {
        msg.streaming = false;
        msg.endedAt ??= now;
      }
    }
    refreshChat();
    persistCurrentSession();
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
      endedAt: Date.now(),
    });
    refreshChat();
  }

  function fileLabel(path: string): string {
    return path.split(/[/\\]/).pop() || path;
  }

  async function openAttachment(id: string): Promise<void> {
    const item = attachments.find((a) => a.id === id);
    if (!item || !panelHost || item.kind === "directory") return;
    if (!item.path) return;
    await panelHost.openNote(item.path);
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
      label: fileLabel(rel),
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
      const now = Date.now();
      const last = uiMessages[uiMessages.length - 1];
      if (last?.kind === "assistant") {
        last.streaming = false;
        last.endedAt = now;
        if (event.content) last.content = event.content;
      } else if (event.content) {
        uiMessages.push({
          id: newId(),
          kind: "assistant",
          content: event.content,
          endedAt: now,
        });
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

    const sendAttachments = resolveSendAttachments({
      userAttachments: atts,
      activeFilePath: panelHost?.getActiveFilePath() ?? null,
      attachActiveNote: prefs.attachActiveNote,
      makeId: newId,
      labelForPath: fileLabel,
    });
    const packed = packAttachmentContext(await loadAttachmentContents(sendAttachments));
    const userContent = formatUserTurnWithAttachments(text, packed.text);

    // Cap check before mutating the draft so cancel leaves the composer intact.
    if (!currentSessionId && wouldEvictAiChatSession(sessions, { id: "__new__" })) {
      const ok = await confirmHistoryEviction();
      if (!ok) return;
    }

    uiMessages.push({ id: newId(), kind: "user", content: text });
    history.push({ role: "user", content: userContent });
    ensureSessionForFirstMessage(text);
    composer.setText("");
    // Chips stay as the user’s explicit attachments only (never silent active-note).
    attachments = attachments.filter((a) => a.kind === "file" || a.kind === "directory");
    composer.setAttachments(attachments);
    refreshChat();
    persistCurrentSession();

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
      fallbackLanguage: agentFallbackLanguageLabel(getLocale()),
      onEvent: handleLoopEvent,
    });

    // Persist assistant turn(s) already reflected in UI into history for multi-turn.
    const lastAssistant = [...uiMessages].reverse().find((m) => m.kind === "assistant");
    if (lastAssistant?.content) {
      lastAssistant.endedAt ??= Date.now();
      // history already has the user message; append final assistant text only
      // Tool transcripts stay inside the loop's message list for the request;
      // for follow-ups we keep a simplified history of user + last assistant.
      history.push({ role: "assistant", content: lastAssistant.content });
    }

    running = false;
    composer.setRunning(false);
    abort = null;
    refreshChat();
    persistCurrentSession();
  }

  const unsubLocale = onLocaleChange(() => {
    historyBtn.title = t("ai.history");
    historyBtn.setAttribute("aria-label", t("ai.history"));
    newBtn.title = t("ai.newChat");
    newBtn.setAttribute("aria-label", t("ai.newChat"));
    undoBtn.title = t("ai.undoWrite");
    undoBtn.setAttribute("aria-label", t("ai.undoWrite"));
    if (historyMenu.isOpen()) renderHistoryMenu();
  });

  return {
    el: hostEl,
    focusComposer() {
      composer.focus();
    },
    newChat,
    setHost(next) {
      panelHost = next;
    },
    persistActiveSession: persistCurrentSession,
    syncWorkspace,
    destroy() {
      stop();
      document.removeEventListener("keydown", onDocumentKeydown);
      closeHistoryMenu();
      unregisterVaultDrop();
      unsubLocale();
      historyMenu.destroy();
      toolbar.destroy();
      chat.destroy();
      composer.destroy();
      hostEl.replaceChildren();
    },
  };
}
