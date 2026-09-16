import { applyUniqueReplace } from "./apply-edit.ts";
import type { WriteUndoEntry } from "../types.ts";

export interface AgentToolHost {
  getActiveNote(): { path: string | null; content: string } | null;
  readFile(path: string): Promise<string>;
  listDir(
    path: string,
  ): Promise<Array<{ name: string; kind: "file" | "directory"; path: string }>>;
  searchVault(query: string): Promise<
    Array<{ path: string; fileName: string; nameMatch: boolean; preview: string }>
  >;
  writeFile(path: string, content: string): Promise<void>;
  openNote(path: string): Promise<void>;
  /**
   * Called after a successful write so the UI can refresh editor state.
   * `aiOwned` marks the write as intentional AI output (skip external-change UX).
   */
  onFileWritten?(
    path: string,
    content: string,
    opts?: { aiOwned?: boolean },
  ): void;
}

export interface ToolExecResult {
  ok: boolean;
  output: string;
  undo?: WriteUndoEntry;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Execute one named tool against the workspace host. */
export async function executeAgentTool(
  name: string,
  argumentsJson: string,
  host: AgentToolHost,
): Promise<ToolExecResult> {
  const args = parseArgs(argumentsJson);

  try {
    switch (name) {
      case "get_active_note": {
        const note = host.getActiveNote();
        if (!note || !note.path) {
          return { ok: true, output: JSON.stringify({ path: null, content: "" }) };
        }
        return {
          ok: true,
          output: JSON.stringify({ path: note.path, content: note.content }),
        };
      }
      case "read_file": {
        const path = str(args.path);
        if (!path) return { ok: false, output: "path is required" };
        const content = await host.readFile(path);
        return { ok: true, output: content };
      }
      case "list_dir": {
        const path = str(args.path);
        const entries = await host.listDir(path);
        return { ok: true, output: JSON.stringify(entries, null, 2) };
      }
      case "search_vault": {
        const query = str(args.query);
        if (!query.trim()) return { ok: false, output: "query is required" };
        const hits = await host.searchVault(query);
        return { ok: true, output: JSON.stringify(hits, null, 2) };
      }
      case "apply_edit": {
        const path = str(args.path);
        const oldString = str(args.old_string);
        const newString = str(args.new_string);
        if (!path) return { ok: false, output: "path is required" };
        const before = await host.readFile(path);
        const edited = applyUniqueReplace(before, oldString, newString);
        if (!edited.ok) return { ok: false, output: edited.error };
        await host.writeFile(path, edited.text);
        host.onFileWritten?.(path, edited.text, { aiOwned: true });
        return {
          ok: true,
          output: `Updated ${path}`,
          undo: { path, before, after: edited.text },
        };
      }
      case "write_file": {
        const path = str(args.path);
        const content = str(args.content);
        if (!path) return { ok: false, output: "path is required" };
        let before = "";
        try {
          before = await host.readFile(path);
        } catch {
          before = "";
        }
        await host.writeFile(path, content);
        host.onFileWritten?.(path, content, { aiOwned: true });
        return {
          ok: true,
          output: `Wrote ${path}`,
          undo: { path, before, after: content },
        };
      }
      case "open_note": {
        const path = str(args.path);
        if (!path) return { ok: false, output: "path is required" };
        await host.openNote(path);
        return { ok: true, output: `Opened ${path}` };
      }
      default:
        return { ok: false, output: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}
