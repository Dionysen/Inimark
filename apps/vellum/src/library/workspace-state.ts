import { pwListSettings, pwSetSetting } from "@dionysen/purewriter-store";

/** Stored in Room.db, so it travels with Vellum's PWB backups and sync restores. */
export const WORKSPACE_STATE_SETTING_KEY = "vellum.workspace.v1";
const MAX_ARTICLE_VIEWS = 100;

export interface ArticleViewState {
  caret: number;
  scrollTop: number;
  updatedAt: number;
}

export interface LibraryWorkspaceState {
  version: 1;
  selectedBookId: string | null;
  openArticleId: string | null;
  collapsedVolumeIdsByBook: Record<string, string[]>;
  articleViews: Record<string, ArticleViewState>;
}

export function createWorkspaceState(): LibraryWorkspaceState {
  return {
    version: 1,
    selectedBookId: null,
    openArticleId: null,
    collapsedVolumeIdsByBook: {},
    articleViews: {},
  };
}

function normalizeView(raw: unknown): ArticleViewState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const caret = Number(value.caret);
  const scrollTop = Number(value.scrollTop);
  const updatedAt = Number(value.updatedAt);
  if (!Number.isFinite(caret) || !Number.isFinite(scrollTop)) return null;
  return {
    caret: Math.max(0, Math.floor(caret)),
    scrollTop: Math.max(0, Math.floor(scrollTop)),
    updatedAt: Number.isFinite(updatedAt) ? Math.max(0, Math.floor(updatedAt)) : 0,
  };
}

/** Ignore malformed and future workspace records rather than blocking a library open. */
export function parseWorkspaceState(raw: string | null | undefined): LibraryWorkspaceState {
  if (!raw) return createWorkspaceState();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.version !== 1) return createWorkspaceState();
    const collapsedRaw = value.collapsedVolumeIdsByBook;
    const collapsedVolumeIdsByBook: Record<string, string[]> = {};
    if (collapsedRaw && typeof collapsedRaw === "object") {
      for (const [bookId, volumeIds] of Object.entries(collapsedRaw)) {
        if (Array.isArray(volumeIds)) {
          collapsedVolumeIdsByBook[bookId] = volumeIds.filter(
            (id): id is string => typeof id === "string",
          );
        }
      }
    }
    const articleViews: Record<string, ArticleViewState> = {};
    if (value.articleViews && typeof value.articleViews === "object") {
      for (const [articleId, view] of Object.entries(value.articleViews)) {
        const normalized = normalizeView(view);
        if (normalized) articleViews[articleId] = normalized;
      }
    }
    return {
      version: 1,
      selectedBookId: typeof value.selectedBookId === "string" ? value.selectedBookId : null,
      openArticleId: typeof value.openArticleId === "string" ? value.openArticleId : null,
      collapsedVolumeIdsByBook,
      articleViews,
    };
  } catch {
    return createWorkspaceState();
  }
}

export async function loadWorkspaceState(): Promise<LibraryWorkspaceState> {
  const settings = await pwListSettings();
  return parseWorkspaceState(
    settings.find((setting) => setting.key === WORKSPACE_STATE_SETTING_KEY)?.value,
  );
}

/** Keep the synced setting bounded even in libraries with many old articles. */
export function rememberArticleView(
  state: LibraryWorkspaceState,
  articleId: string,
  view: Omit<ArticleViewState, "updatedAt">,
  now = Date.now(),
): void {
  state.articleViews[articleId] = { ...view, updatedAt: now };
  const retained = Object.entries(state.articleViews)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ARTICLE_VIEWS);
  state.articleViews = Object.fromEntries(retained);
}

export function saveWorkspaceState(state: LibraryWorkspaceState): Promise<void> {
  return pwSetSetting(WORKSPACE_STATE_SETTING_KEY, JSON.stringify(state)).then(() => undefined);
}
