import { showExportDialog, closeExportDialog, isExportDialogOpen } from "./dialog.ts";

export interface NoteExportController {
  open(options: {
    markdown: string;
    title: string;
    baseName: string;
    rewriteSrc?: (src: string) => string | null | Promise<string | null>;
  }): Promise<void>;
  close(): void;
  isOpen(): boolean;
  onChange(listener: (open: boolean) => void): () => void;
}

export function createNoteExportController(): NoteExportController {
  const listeners = new Set<(open: boolean) => void>();

  function notify(open: boolean): void {
    for (const listener of listeners) listener(open);
  }

  return {
    async open(options) {
      await showExportDialog({
        ...options,
        onOpenChange: notify,
      });
    },
    close() {
      closeExportDialog();
    },
    isOpen() {
      return isExportDialogOpen();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
