/*
 * A tiny promise-based IndexedDB wrapper — deliberately dependency-free (no `idb`
 * npm package) since the surface we need is small. Used by the offline PDI layer to
 * cache checklist state and queue mutations while a technician has no connection.
 */

const DB_NAME = 'ams-offline';
const DB_VERSION = 1;

/** Object stores. Keep in sync with the upgrade handler below. */
export const STORE_PDI_JOBS = 'pdiJobs'; // keyPath: vehicleId — cached job snapshot per vehicle
export const STORE_MUTATIONS = 'mutations'; // autoIncrement — the replay queue

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PDI_JOBS)) {
        db.createObjectStore(STORE_PDI_JOBS, { keyPath: 'vehicleId' });
      }
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        db.createObjectStore(STORE_MUTATIONS, { keyPath: 'seq', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        transaction.onerror = () => reject(transaction.error);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export function idbPut<T>(store: string, value: T): Promise<IDBValidKey> {
  return tx<IDBValidKey>(store, 'readwrite', (s) => s.put(value as unknown as Record<string, unknown>));
}

export function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return tx<T | undefined>(store, 'readonly', (s) => s.get(key));
}

export function idbGetAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll());
}

export function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  return tx<undefined>(store, 'readwrite', (s) => s.delete(key)).then(() => undefined);
}

/** Whether IndexedDB is usable in this context (it isn't in some private-mode browsers). */
export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
