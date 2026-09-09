import { showLibraryAddedToast } from "./added-toast.ts";
import { upsertLibrary } from "./store.ts";
import { isTauri } from "../platform/env.ts";

export interface LibraryDropTargetOptions {
  onAdded?: (rootPath: string) => void;
  /** Toast anchor (e.g. main column or settings main wrap). */
  toastHost?: HTMLElement;
}

interface RegisteredTarget {
  element: HTMLElement;
  options: LibraryDropTargetOptions;
}

const DROP_TARGET_CLASS = "is-library-drop-target";

const targets = new Set<RegisteredTarget>();
let tauriUnlisten: (() => void) | null = null;
let tauriListenerCount = 0;

function pointInElement(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function hitTarget(x: number, y: number): RegisteredTarget | null {
  for (const target of targets) {
    if (pointInElement(target.element, x, y)) return target;
  }
  return null;
}

function setDropHighlight(element: HTMLElement | null, active: boolean): void {
  for (const target of targets) {
    const on = active && target.element === element;
    target.element.classList.toggle(DROP_TARGET_CLASS, on);
  }
}

async function isDirectoryPath(path: string): Promise<boolean> {
  if (!isTauri()) return true;
  try {
    const { stat } = await import("@tauri-apps/plugin-fs");
    return (await stat(path)).isDirectory;
  } catch {
    return false;
  }
}

async function firstDirectoryFromPaths(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    if (await isDirectoryPath(path)) return path;
  }
  return null;
}

async function addLibraryFromPath(
  rootPath: string,
  options?: LibraryDropTargetOptions,
): Promise<boolean> {
  const dir = await firstDirectoryFromPaths([rootPath]);
  if (!dir) return false;
  const { record, created } = upsertLibrary(dir);
  options?.onAdded?.(dir);
  if (created && options?.toastHost) {
    showLibraryAddedToast(options.toastHost, record.rootName);
  }
  return true;
}

async function pathsFromDataTransfer(dataTransfer: DataTransfer): Promise<string[]> {
  const paths: string[] = [];
  for (const file of dataTransfer.files) {
    const path = (file as File & { path?: string }).path;
    if (path) paths.push(path);
  }
  if (paths.length > 0) return paths;

  const items = dataTransfer.items;
  if (!items) return paths;

  const readEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isDirectory) {
      const dir = entry as FileSystemDirectoryEntry;
      const fullPath = (dir as FileSystemDirectoryEntry & { fullPath?: string }).fullPath;
      if (fullPath) paths.push(fullPath);
    }
  };

  const tasks: Promise<void>[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) tasks.push(readEntry(entry));
  }
  await Promise.all(tasks);
  return paths;
}

async function handleDroppedPaths(
  paths: string[],
  options?: LibraryDropTargetOptions,
): Promise<boolean> {
  const dir = await firstDirectoryFromPaths(paths);
  if (!dir) return false;
  return addLibraryFromPath(dir, options);
}

function bindHtmlDrop(element: HTMLElement, options: LibraryDropTargetOptions): () => void {
  let depth = 0;

  const onDragEnter = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    depth += 1;
    setDropHighlight(element, true);
  };

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropHighlight(element, true);
  };

  const onDragLeave = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) setDropHighlight(null, false);
  };

  const onDrop = (event: DragEvent) => {
    if (!event.dataTransfer) return;
    event.preventDefault();
    depth = 0;
    setDropHighlight(null, false);
    void (async () => {
      const paths = await pathsFromDataTransfer(event.dataTransfer!);
      await handleDroppedPaths(paths, options);
    })();
  };

  element.addEventListener("dragenter", onDragEnter);
  element.addEventListener("dragover", onDragOver);
  element.addEventListener("dragleave", onDragLeave);
  element.addEventListener("drop", onDrop);

  return () => {
    element.removeEventListener("dragenter", onDragEnter);
    element.removeEventListener("dragover", onDragOver);
    element.removeEventListener("dragleave", onDragLeave);
    element.removeEventListener("drop", onDrop);
    element.classList.remove(DROP_TARGET_CLASS);
  };
}

async function ensureTauriDropListener(): Promise<void> {
  if (!isTauri() || tauriUnlisten) return;
  try {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    const webview = getCurrentWebview();
    tauriUnlisten = await webview.onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "over") {
        const hit = hitTarget(payload.position.x, payload.position.y);
        setDropHighlight(hit?.element ?? null, Boolean(hit));
        return;
      }
      if (payload.type === "leave") {
        setDropHighlight(null, false);
        return;
      }
      if (payload.type === "drop") {
        const hit = hitTarget(payload.position.x, payload.position.y);
        setDropHighlight(null, false);
        if (!hit) return;
        void handleDroppedPaths(payload.paths, hit.options);
      }
    });
  } catch {
    /* HTML drop handlers remain available where supported */
  }
}

function releaseTauriDropListener(): void {
  if (targets.size > 0 || tauriListenerCount > 0) return;
  tauriUnlisten?.();
  tauriUnlisten = null;
}

/** Accept OS folder drops to register a new document library. */
export function mountLibraryDropTarget(
  element: HTMLElement,
  options: LibraryDropTargetOptions = {},
): () => void {
  const registered: RegisteredTarget = { element, options };
  targets.add(registered);
  tauriListenerCount += 1;
  void ensureTauriDropListener();

  const unbindHtml = bindHtmlDrop(element, options);

  return () => {
    targets.delete(registered);
    tauriListenerCount = Math.max(0, tauriListenerCount - 1);
    element.classList.remove(DROP_TARGET_CLASS);
    unbindHtml();
    releaseTauriDropListener();
  };
}
