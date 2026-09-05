import { parseWikiLinks, isImageWikiTarget } from "./parser.ts";

export interface LinkIndexSnapshot {
  outlinks: Map<string, string[]>;
  backlinks: Map<string, string[]>;
  fileByName: Map<string, string>;
  imageByName: Map<string, string>;
}

export interface NoteSearchHit {
  name: string;
  path: string;
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
  "ico",
  "heic",
  "heif",
  "tif",
  "tiff",
  "apng",
  "jfif",
  "jxl",
]);

const CACHE_KEY = "inimark:link-index";
const CACHE_VAULT_KEY = "inimark:link-index-vault";

function pathToNoteName(relativePath: string): string {
  return relativePath
    .replace(/\\/g, "/")
    .replace(/\.(md|markdown|mdown|canvas)$/i, "");
}

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class LinkIndexServiceImpl {
  private index: LinkIndexSnapshot = {
    outlinks: new Map(),
    backlinks: new Map(),
    fileByName: new Map(),
    imageByName: new Map(),
  };
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    this.index = {
      outlinks: new Map(),
      backlinks: new Map(),
      fileByName: new Map(),
      imageByName: new Map(),
    };
    this.notify();
  }

  toNoteName(relativePath: string): string {
    return pathToNoteName(relativePath);
  }

  ensureFileByName(noteName: string, filePath: string): void {
    const existing = this.index.fileByName.get(noteName);
    if (!existing || filePath.length < existing.length) {
      this.index.fileByName.set(noteName, filePath);
    }
  }

  ensureImageByName(lowerName: string, filePath: string): void {
    const existing = this.index.imageByName.get(lowerName);
    if (!existing || filePath.length < existing.length) {
      this.index.imageByName.set(lowerName, filePath);
    }
  }

  registerFile(relativePath: string): void {
    const name = relativePath.split(/[/\\]/).pop() || "";
    const ext = fileExt(name);
    if (IMAGE_EXTENSIONS.has(ext)) {
      this.ensureImageByName(name.toLowerCase(), relativePath.replace(/\\/g, "/"));
      return;
    }
    if (/\.(md|markdown|mdown|canvas)$/i.test(name)) {
      const noteName = pathToNoteName(relativePath);
      this.ensureFileByName(noteName, relativePath.replace(/\\/g, "/"));
    }
  }

  addFileLinks(filePath: string, content: string): void {
    const normalized = filePath.replace(/\\/g, "/");
    const noteName = pathToNoteName(normalized);

    const oldTargets = this.index.outlinks.get(normalized) || [];
    for (const oldTarget of oldTargets) {
      const sources = this.index.backlinks.get(oldTarget);
      if (!sources) continue;
      const filtered = sources.filter((s) => s !== normalized);
      if (filtered.length === 0) this.index.backlinks.delete(oldTarget);
      else this.index.backlinks.set(oldTarget, filtered);
    }

    const links = parseWikiLinks(content);
    const targets = links
      .map((l) => l.noteName)
      .filter((n) => n.length > 0 && !isImageWikiTarget(n));
    this.index.outlinks.set(normalized, targets);

    for (const target of targets) {
      const existing = this.index.backlinks.get(target) || [];
      if (!existing.includes(normalized)) {
        existing.push(normalized);
        this.index.backlinks.set(target, existing);
      }
    }

    this.ensureFileByName(noteName, normalized);
    this.notify();
  }

  removeFile(filePath: string): void {
    const normalized = filePath.replace(/\\/g, "/");
    const targets = this.index.outlinks.get(normalized) || [];
    for (const target of targets) {
      const sources = this.index.backlinks.get(target);
      if (!sources) continue;
      const filtered = sources.filter((s) => s !== normalized);
      if (filtered.length === 0) this.index.backlinks.delete(target);
      else this.index.backlinks.set(target, filtered);
    }
    this.index.outlinks.delete(normalized);

    for (const [name, path] of this.index.fileByName) {
      if (path === normalized) {
        this.index.fileByName.delete(name);
        break;
      }
    }
    for (const [name, path] of this.index.imageByName) {
      if (path === normalized) this.index.imageByName.delete(name);
    }
    this.notify();
  }

  getOutlinks(filePath: string): string[] {
    return this.index.outlinks.get(filePath.replace(/\\/g, "/")) || [];
  }

  getBacklinks(noteName: string): string[] {
    const direct = this.index.backlinks.get(noteName) || [];
    if (direct.length > 0) return [...direct];

    // Also collect by basename match of indexed keys.
    const lower = noteName.toLowerCase();
    const out = new Set<string>();
    for (const [key, sources] of this.index.backlinks) {
      const base = key.split("/").pop()?.toLowerCase();
      if (key.toLowerCase() === lower || base === lower) {
        for (const s of sources) out.add(s);
      }
    }
    return [...out];
  }

  findFileByNoteName(noteName: string): string | undefined {
    const exact = this.index.fileByName.get(noteName);
    if (exact) return exact;

    const lower = noteName.toLowerCase();
    let bestPath: string | undefined;
    let bestDepth = Infinity;
    for (const [key, path] of this.index.fileByName) {
      const basename = key.split("/").pop()?.toLowerCase();
      if (basename === lower || key.toLowerCase() === lower) {
        const depth = key.split("/").length;
        if (depth < bestDepth) {
          bestDepth = depth;
          bestPath = path;
        }
      }
    }
    return bestPath;
  }

  findImageByBaseName(name: string): string | undefined {
    return this.index.imageByName.get(name.toLowerCase());
  }

  searchNotes(query: string, limit = 40): NoteSearchHit[] {
    const lowerQuery = query.toLowerCase();
    const results: NoteSearchHit[] = [];
    for (const [name, path] of this.index.fileByName) {
      const basename = name.split("/").pop() || name;
      if (
        !lowerQuery ||
        name.toLowerCase().includes(lowerQuery) ||
        basename.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ name, path });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  getAllNotes(): NoteSearchHit[] {
    return [...this.index.fileByName.entries()].map(([name, path]) => ({
      name,
      path,
    }));
  }

  getAffectedLinkCount(oldPath: string): { filesCount: number; linksCount: number } {
    const oldNoteName = pathToNoteName(oldPath);
    const backlinkFiles = this.getBacklinks(oldNoteName);
    let linksCount = 0;
    for (const filePath of backlinkFiles) {
      const targets = this.getOutlinks(filePath);
      linksCount += targets.filter(
        (t) =>
          t === oldNoteName ||
          t.split("/").pop()?.toLowerCase() ===
            oldNoteName.split("/").pop()?.toLowerCase(),
      ).length;
    }
    return { filesCount: backlinkFiles.length, linksCount };
  }

  /**
   * Rewrite wiki targets in backlink files. Caller provides read/write.
   */
  async rewriteWikiLinks(
    oldPath: string,
    newPath: string,
    readFile: (path: string) => Promise<string | null>,
    writeFile: (path: string, content: string) => Promise<void>,
  ): Promise<{ filesUpdated: number; linksUpdated: number }> {
    const oldNoteName = pathToNoteName(oldPath);
    const newNoteName = pathToNoteName(newPath);
    if (oldNoteName === newNoteName) return { filesUpdated: 0, linksUpdated: 0 };

    const backlinkFiles = this.getBacklinks(oldNoteName);
    if (backlinkFiles.length === 0) {
      this.removeFile(oldPath);
      this.registerFile(newPath);
      this.notify();
      return { filesUpdated: 0, linksUpdated: 0 };
    }

    const escapedOld = escapeRegex(oldNoteName);
    const linkRegex = new RegExp(`(!?\\[\\[${escapedOld})(?=\\]\\]|[#|])`, "g");

    let filesUpdated = 0;
    let linksUpdated = 0;

    for (const filePath of backlinkFiles) {
      const content = await readFile(filePath);
      if (content == null) continue;
      let count = 0;
      const newContent = content.replace(linkRegex, (match) => {
        count++;
        return match.replace(oldNoteName, newNoteName);
      });
      if (newContent !== content) {
        await writeFile(filePath, newContent);
        linksUpdated += count;
        filesUpdated++;
        this.addFileLinks(filePath, newContent);
      }
    }

    this.removeFile(oldPath);
    this.registerFile(newPath);
    this.notify();
    return { filesUpdated, linksUpdated };
  }

  serialize(): string {
    return JSON.stringify({
      outlinks: [...this.index.outlinks.entries()],
      backlinks: [...this.index.backlinks.entries()],
      fileByName: [...this.index.fileByName.entries()],
      imageByName: [...this.index.imageByName.entries()],
    });
  }

  deserialize(json: string): boolean {
    try {
      const data = JSON.parse(json) as {
        outlinks: [string, string[]][];
        backlinks: [string, string[]][];
        fileByName: [string, string][];
        imageByName: [string, string][];
      };
      this.index = {
        outlinks: new Map(data.outlinks),
        backlinks: new Map(data.backlinks),
        fileByName: new Map(data.fileByName),
        imageByName: new Map(data.imageByName),
      };
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  persistCache(vaultId: string): void {
    try {
      localStorage.setItem(CACHE_VAULT_KEY, vaultId);
      localStorage.setItem(CACHE_KEY, this.serialize());
    } catch {
      /* ignore quota */
    }
  }

  restoreCache(vaultId: string): boolean {
    try {
      if (localStorage.getItem(CACHE_VAULT_KEY) !== vaultId) return false;
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      return this.deserialize(raw);
    } catch {
      return false;
    }
  }
}

export const linkIndex = new LinkIndexServiceImpl();
