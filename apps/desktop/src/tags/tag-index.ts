import { collectTagNamesFromMarkdown } from "@inimark/editor";

export type TagSortMode = "name-asc" | "name-desc" | "count-asc" | "count-desc";

export interface TagEntry {
  name: string;
  /** Number of notes that contain this tag. */
  count: number;
  files: string[];
}

class TagIndexServiceImpl {
  /** tag name → set of file paths */
  private tagToFiles = new Map<string, Set<string>>();
  /** file path → set of tag names */
  private fileToTags = new Map<string, Set<string>>();
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    this.tagToFiles.clear();
    this.fileToTags.clear();
    this.notify();
  }

  setFileTags(filePath: string, content: string): void {
    const normalized = filePath.replace(/\\/g, "/");
    const nextTags = new Set(collectTagNamesFromMarkdown(content));
    const prevTags = this.fileToTags.get(normalized);

    if (prevTags) {
      for (const tag of prevTags) {
        if (nextTags.has(tag)) continue;
        const files = this.tagToFiles.get(tag);
        if (!files) continue;
        files.delete(normalized);
        if (files.size === 0) this.tagToFiles.delete(tag);
      }
    }

    for (const tag of nextTags) {
      let files = this.tagToFiles.get(tag);
      if (!files) {
        files = new Set();
        this.tagToFiles.set(tag, files);
      }
      files.add(normalized);
    }

    if (nextTags.size === 0) this.fileToTags.delete(normalized);
    else this.fileToTags.set(normalized, nextTags);

    this.notify();
  }

  removeFile(filePath: string): void {
    const normalized = filePath.replace(/\\/g, "/");
    const tags = this.fileToTags.get(normalized);
    if (!tags) return;
    for (const tag of tags) {
      const files = this.tagToFiles.get(tag);
      if (!files) continue;
      files.delete(normalized);
      if (files.size === 0) this.tagToFiles.delete(tag);
    }
    this.fileToTags.delete(normalized);
    this.notify();
  }

  remapPaths(pairs: Array<{ from: string; to: string }>): void {
    if (pairs.length === 0) return;
    const remap = (path: string): string => {
      for (const { from, to } of pairs) {
        if (path === from) return to;
        if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
      }
      return path;
    };

    const nextFileToTags = new Map<string, Set<string>>();
    for (const [path, tags] of this.fileToTags) {
      nextFileToTags.set(remap(path), tags);
    }
    this.fileToTags = nextFileToTags;

    const nextTagToFiles = new Map<string, Set<string>>();
    for (const [tag, files] of this.tagToFiles) {
      const mapped = new Set<string>();
      for (const path of files) mapped.add(remap(path));
      nextTagToFiles.set(tag, mapped);
    }
    this.tagToFiles = nextTagToFiles;
    this.notify();
  }

  listTags(sort: TagSortMode = "name-asc"): TagEntry[] {
    const entries: TagEntry[] = [];
    for (const [name, files] of this.tagToFiles) {
      const list = [...files].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
      entries.push({ name, count: list.length, files: list });
    }
    entries.sort((a, b) => {
      if (sort === "count-asc" || sort === "count-desc") {
        const cmp = a.count - b.count;
        if (cmp !== 0) return sort === "count-asc" ? cmp : -cmp;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return sort === "name-desc" ? -byName : byName;
    });
    return entries;
  }

  getTagsForFile(filePath: string): string[] {
    const tags = this.fileToTags.get(filePath.replace(/\\/g, "/"));
    return tags ? [...tags] : [];
  }
}

export const tagIndex = new TagIndexServiceImpl();
