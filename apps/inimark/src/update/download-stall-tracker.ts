/** Fires when downloaded bytes do not increase for {@link stallMs}. */
export interface DownloadStallTracker {
  start(): void;
  noteProgress(downloadedBytes: number): void;
  stop(): void;
}

export function createDownloadStallTracker(options: {
  stallMs: number;
  onStall: () => void;
}): DownloadStallTracker {
  let lastBytes = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function armTimer(): void {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      options.onStall();
    }, options.stallMs);
  }

  return {
    start() {
      lastBytes = 0;
      armTimer();
    },
    noteProgress(downloadedBytes: number) {
      if (downloadedBytes > lastBytes) {
        lastBytes = downloadedBytes;
        armTimer();
      }
    },
    stop() {
      clearTimer();
    },
  };
}
