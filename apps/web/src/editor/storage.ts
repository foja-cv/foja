// The project lives in IndexedDB, in the browser only: no accounts, no server.

import type { Project } from "@foja/core";

const DB = "foja";
const STORE = "projects";
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export interface Saved {
  project: Project;
  profileId: string;
}

export const loadSaved = () => run<Saved | undefined>("readonly", (s) => s.get(KEY));
export const save = (saved: Saved) => run("readwrite", (s) => s.put(saved, KEY));
export const clearSaved = () => run("readwrite", (s) => s.delete(KEY));
