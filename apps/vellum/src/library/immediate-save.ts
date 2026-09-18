/**
 * Saves as soon as an edit arrives.
 * A second edit during an in-flight save is written once that save finishes,
 * using whatever the editor holds at that moment — not one request per keystroke.
 */
export function createImmediateSaver(save: () => Promise<void>): {
  kick(): void;
  flush(): Promise<void>;
} {
  let active: Promise<void> | null = null;
  let again = false;

  const drain = (): Promise<void> => {
    again = false;
    const run = save()
      .catch(() => {})
      .then(() => {
        if (again) return drain();
        active = null;
      });
    active = run;
    return run;
  };

  return {
    kick() {
      if (active) {
        again = true;
        return;
      }
      void drain();
    },
    flush() {
      if (!active && !again) return Promise.resolve();
      if (!active) void drain();
      return (active ?? Promise.resolve()).then(() => {
        if (again || active) return this.flush();
      });
    },
  };
}
