/**
 * IndexedDB persistence for saving Alpha Lab results.
 *
 * Stores evolution results, factor synthesis outputs, and adaptive WF
 * results so users can review them later without re-running.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const DB_NAME = "alpha-lab";
const DB_VERSION = 1;
const STORE_NAME = "results";

export interface SavedResult {
  id: string;
  mode: "evolve" | "synthesize" | "adaptive-wf";
  name: string;
  timestamp: number;
  result: unknown;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("mode", "mode", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a result to IndexedDB.
 */
export async function saveResult(entry: SavedResult): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load all saved results, optionally filtered by mode.
 */
export async function loadResults(mode?: string): Promise<SavedResult[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    let request: IDBRequest;
    if (mode) {
      const index = store.index("mode");
      request = index.getAll(mode);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const results = request.result as SavedResult[];
      // Sort by timestamp descending (most recent first)
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a saved result by ID.
 */
export async function deleteResult(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * React hook for managing saved results.
 */
export function useSavedResults(mode?: string) {
  const [results, setResults] = useState<SavedResult[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await loadResults(mode);
      setResults(data);
    } catch {
      // IndexedDB may not be available in some environments
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (entry: SavedResult) => {
      await saveResult(entry);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteResult(id);
      await refresh();
    },
    [refresh],
  );

  return { results, loading, save, remove, refresh };
}
