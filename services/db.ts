
import { ManualFile, SavedProject } from "../types";

const DB_NAME = "ElectroExpertDB";
const STORE_MANUALS = "manuals";
const STORE_PROJECTS = "projects";
const DB_VERSION = 2; // Zvýšená verzia pre nový store

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject("Chyba pri otváraní DB");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_MANUALS)) {
        db.createObjectStore(STORE_MANUALS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
    };
  });
};

export const saveManualToDB = async (manual: ManualFile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_MANUALS, "readwrite");
    const store = transaction.objectStore(STORE_MANUALS);
    const request = store.put(manual);
    request.onsuccess = () => resolve();
    request.onerror = () => reject("Chyba pri ukladaní manuálu");
  });
};

export const getAllManualsFromDB = async (): Promise<ManualFile[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_MANUALS, "readonly");
    const store = transaction.objectStore(STORE_MANUALS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Chyba pri načítaní manuálov");
  });
};

export const deleteManualFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_MANUALS, "readwrite");
    const store = transaction.objectStore(STORE_MANUALS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject("Chyba pri mazaní manuálu");
  });
};

// Nové funkcie pre projekty
export const saveProjectToDB = async (project: SavedProject): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, "readwrite");
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.put(project);
    request.onsuccess = () => resolve();
    request.onerror = () => reject("Chyba pri ukladaní projektu");
  });
};

export const getAllProjectsFromDB = async (): Promise<SavedProject[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, "readonly");
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Chyba pri načítaní projektov");
  });
};

export const deleteProjectFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, "readwrite");
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject("Chyba pri mazaní projektu");
  });
};
