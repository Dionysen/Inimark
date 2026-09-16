export const INIMARK_DIR = ".inimark";

export const WORKSPACE_BOOKMARKS_FILE = "bookmarks.json";
export const WORKSPACE_SESSION_FILE = "session.json";
export const WORKSPACE_RECENT_FILE = "recent.json";
export const WORKSPACE_LINK_INDEX_FILE = "link-index.json";
export const WORKSPACE_AI_CHAT_FILE = "ai-chat.json";

export function inimarkRelativePath(fileName: string): string {
  return `${INIMARK_DIR}/${fileName}`;
}
