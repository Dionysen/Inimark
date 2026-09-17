import { beforeEach } from "vitest";

/** happy-dom leaves `document.compatMode` unset; KaTeX warns on import without CSS1Compat. */
Object.defineProperty(document, "compatMode", {
  configurable: true,
  value: "CSS1Compat",
});

/** In-memory localStorage for Vitest — Node 25's built-in stub lacks setItem/clear. */
const memory = new Map<string, string>();

function installLocalStorageMock(): void {
  const storage: Storage = {
    get length() {
      return memory.size;
    },
    key(index: number): string | null {
      return [...memory.keys()][index] ?? null;
    },
    getItem(key: string): string | null {
      return memory.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      memory.set(key, String(value));
    },
    removeItem(key: string): void {
      memory.delete(key);
    },
    clear(): void {
      memory.clear();
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
}

installLocalStorageMock();

beforeEach(() => {
  memory.clear();
});
