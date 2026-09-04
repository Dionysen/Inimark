const DB_NAME = "inimark-library-handles";
const DB_VERSION = 1;
const STORE_NAME = "directory-handles";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveDirectoryHandle(
  libraryId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, libraryId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function loadDirectoryHandle(
  libraryId: string,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDatabase();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(libraryId);
    request.onsuccess = () => {
      const value = request.result;
      resolve(value instanceof Object && "entries" in value ? value : null);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return handle;
}

export async function deleteDirectoryHandle(libraryId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(libraryId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}

export async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const current = await handle.queryPermission({ mode: "read" });
  if (current === "granted") return true;
  const requested = await handle.requestPermission({ mode: "read" });
  return requested === "granted";
}
