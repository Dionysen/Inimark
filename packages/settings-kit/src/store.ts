export interface SettingsSyncPayload<T> {
  settings: T;
  /** Per-window id; listeners ignore echoes from the same webview. */
  emitterId: string;
}

export interface JsonSettingsStoreOptions<T> {
  key: string;
  /** Optional Tauri / custom event name for cross-window live sync. */
  syncEvent?: string;
  defaults: T;
  /** Normalize raw JSON (or partial) into a complete settings object. */
  normalize: (raw: unknown) => T;
  /** Stable per-window id; auto-generated when omitted. */
  emitterId?: string;
}

export interface JsonSettingsStore<T> {
  readonly key: string;
  readonly syncEvent: string | undefined;
  load(): T;
  save(settings: T): void;
  getEmitterId(): string;
  parseSyncPayload(payload: unknown): SettingsSyncPayload<T> | null;
  isExternalSync(payload: SettingsSyncPayload<T>): boolean;
  /**
   * Subscribe to localStorage `storage` events and optional Tauri sync events.
   * Does not fire for same-window `save` calls (storage events are cross-document only).
   */
  subscribe(listener: (settings: T) => void): () => void;
}

function createEmitterId(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `settings-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/**
 * Generic JSON settings store backed by localStorage, with optional Tauri event
 * broadcast for live cross-window sync.
 */
export function createJsonSettingsStore<T>(
  options: JsonSettingsStoreOptions<T>,
): JsonSettingsStore<T> {
  const { key, syncEvent, defaults, normalize } = options;
  const emitterId = createEmitterId(options.emitterId);

  let settingsBroadcaster: ((payload: SettingsSyncPayload<T>) => void) | null =
    null;

  function load(): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(defaults);
      return normalize(JSON.parse(raw) as unknown);
    } catch {
      return structuredClone(defaults);
    }
  }

  function broadcast(settings: T): void {
    if (!syncEvent) return;
    const payload: SettingsSyncPayload<T> = { settings, emitterId };
    if (settingsBroadcaster) {
      settingsBroadcaster(payload);
      return;
    }
    if (!isTauriRuntime()) {
      settingsBroadcaster = () => {};
      return;
    }
    void import("@tauri-apps/api/event")
      .then(({ emit }) => {
        settingsBroadcaster = (next) => {
          void emit(syncEvent, next).catch(() => {});
        };
        settingsBroadcaster(payload);
      })
      .catch(() => {
        settingsBroadcaster = () => {};
      });
  }

  function save(settings: T): void {
    localStorage.setItem(key, JSON.stringify(settings));
    broadcast(settings);
  }

  function parseSyncPayload(payload: unknown): SettingsSyncPayload<T> | null {
    if (!payload || typeof payload !== "object") return null;
    const rec = payload as Record<string, unknown>;
    if ("emitterId" in rec && "settings" in rec) {
      return {
        emitterId: String(rec.emitterId),
        settings: normalize(rec.settings),
      };
    }
    // Legacy bare settings object (pre-emitterId wrapper).
    return {
      emitterId: "",
      settings: normalize(payload),
    };
  }

  function isExternalSync(payload: SettingsSyncPayload<T>): boolean {
    return payload.emitterId !== emitterId;
  }

  function subscribe(listener: (settings: T) => void): () => void {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== key) return;
      listener(load());
    };
    window.addEventListener("storage", onStorage);

    let unlistenTauri: (() => void) | undefined;
    if (syncEvent && isTauriRuntime()) {
      void import("@tauri-apps/api/event")
        .then(async ({ listen }) => {
          unlistenTauri = await listen(syncEvent!, (event) => {
            const parsed = parseSyncPayload(event.payload);
            if (!parsed || !isExternalSync(parsed)) return;
            listener(parsed.settings);
          });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      unlistenTauri?.();
    };
  }

  return {
    key,
    syncEvent,
    load,
    save,
    getEmitterId: () => emitterId,
    parseSyncPayload,
    isExternalSync,
    subscribe,
  };
}
