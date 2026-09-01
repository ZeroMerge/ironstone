import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'ironstone';
export const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 → create all stores
        if (oldVersion < 1) {
          const projects = db.createObjectStore('project', { keyPath: 'id' });
          projects.createIndex('createdAt', 'createdAt');

          const images = db.createObjectStore('image', { keyPath: 'id' });
          images.createIndex('projectId', 'projectId');
          images.createIndex('styleGroupId', 'styleGroupId');
          images.createIndex('createdAt', 'createdAt');

          const pages = db.createObjectStore('page', { keyPath: 'id' });
          pages.createIndex('projectId', 'projectId');

          db.createObjectStore('styleGroup', { keyPath: 'id' });
          db.createObjectStore('userSettings', { keyPath: 'id' });
        }
        // v2 → fix userSettings keyPath ('key' → 'id')
        if (oldVersion === 1) {
          if (db.objectStoreNames.contains('userSettings')) {
            db.deleteObjectStore('userSettings');
          }
          db.createObjectStore('userSettings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}


