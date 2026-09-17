/** In-session open-file history for titlebar back / forward. */
export class FileNavigationHistory {
  private stack: string[] = [];
  private index = -1;
  private suppressing = false;

  record(path: string | null | undefined): void {
    if (this.suppressing) return;
    if (!path) return;
    if (this.stack[this.index] === path) return;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(path);
    this.index = this.stack.length - 1;
    const MAX = 100;
    if (this.stack.length > MAX) {
      const drop = this.stack.length - MAX;
      this.stack = this.stack.slice(drop);
      this.index -= drop;
    }
  }

  canBack(): boolean {
    return this.index > 0;
  }

  canForward(): boolean {
    return this.index >= 0 && this.index < this.stack.length - 1;
  }

  back(): string | null {
    if (!this.canBack()) return null;
    this.index -= 1;
    return this.stack[this.index] ?? null;
  }

  forward(): string | null {
    if (!this.canForward()) return null;
    this.index += 1;
    return this.stack[this.index] ?? null;
  }

  /**
   * Drop the current entry (and any forward branch) and return the previous
   * path to open after closing the active file.
   */
  closeCurrent(): string | null {
    if (this.index < 0) return null;
    this.stack = this.stack.slice(0, this.index);
    this.index = this.stack.length - 1;
    if (this.index < 0) return null;
    return this.stack[this.index] ?? null;
  }

  /** Run a history jump without recording the destination as a new entry. */
  async navigate(open: (path: string) => Promise<void>, path: string): Promise<void> {
    this.suppressing = true;
    try {
      await open(path);
    } finally {
      this.suppressing = false;
    }
  }

  clear(): void {
    this.stack = [];
    this.index = -1;
  }

  /** Keep history valid after renames / moves. */
  remap(pairs: Array<{ from: string; to: string }>): void {
    if (pairs.length === 0) return;
    this.stack = this.stack.map((path) => {
      for (const { from, to } of pairs) {
        if (path === from) return to;
        if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
      }
      return path;
    });
  }
}
