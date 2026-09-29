// Persistence for a user-supplied VRM (e.g. exported from VRoid Studio).
// Stored as a Blob in IndexedDB so it survives reloads without a server.
const DB_NAME = "albedo-vrm";
const STORE = "models";
const KEY = "custom";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveVrmBlob(blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function loadVrmBlob(): Promise<Blob | null> {
  try {
    const db = await open();
    const blob = await new Promise<Blob | null>((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(KEY);
      rq.onsuccess = () => res((rq.result as Blob) || null);
      rq.onerror = () => rej(rq.error ?? new Error("IndexedDB read failed"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function clearVrmBlob(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
    db.close();
  } catch {
    /* ignore */
  }
}
