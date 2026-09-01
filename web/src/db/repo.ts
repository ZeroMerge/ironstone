import { getDB } from './index';
import type { ImageRec, Page, Project, StyleGroup, UserSettings } from '../lib/types';
import { uid } from '../lib/grid';

// ---------- Projects ----------

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = (await db.getAll('project')) as Project[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return (await db.get('project', id)) as Project | undefined;
}

export async function createProject(name: string, orientation: Project['orientation']): Promise<Project> {
  const db = await getDB();
  const project: Project = { id: uid(), name, orientation, createdAt: Date.now() };
  await db.put('project', project);
  return project;
}

export async function updateProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('project', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['project', 'image', 'page'], 'readwrite');
  await tx.objectStore('project').delete(id);
  const images = (await tx.objectStore('image').index('projectId').getAllKeys(id)) as string[];
  for (const key of images) await tx.objectStore('image').delete(key);
  const pages = (await tx.objectStore('page').index('projectId').getAllKeys(id)) as string[];
  for (const key of pages) await tx.objectStore('page').delete(key);
  await tx.done;
}

// ---------- Images ----------

export async function listProjectImages(projectId: string): Promise<ImageRec[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex('image', 'projectId', projectId)) as ImageRec[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listStyleImages(styleGroupId: string): Promise<ImageRec[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex('image', 'styleGroupId', styleGroupId)) as ImageRec[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listAllStyleImages(): Promise<ImageRec[]> {
  const db = await getDB();
  const all = (await db.getAll('image')) as ImageRec[];
  return all.filter((i) => i.styleGroupId !== null).sort((a, b) => a.createdAt - b.createdAt);
}

export async function getImage(id: string): Promise<ImageRec | undefined> {
  const db = await getDB();
  return (await db.get('image', id)) as ImageRec | undefined;
}

export async function countAllImages(): Promise<number> {
  const db = await getDB();
  return await db.count('image');
}

export async function putImage(rec: Omit<ImageRec, 'id' | 'createdAt'> & { id?: string }): Promise<ImageRec> {
  const db = await getDB();
  const image: ImageRec = { id: rec.id ?? uid(), createdAt: Date.now(), ...rec } as ImageRec;
  await db.put('image', image);
  return image;
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('image', id);
}

// ---------- Pages ----------

export async function listPages(projectId: string): Promise<Page[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex('page', 'projectId', projectId)) as Page[];
  const sorted = all.sort((a, b) => a.order - b.order);

  // Automated 48x32 Micro-Grid Migration:
  // If all blocks on a page have w <= 12 and x <= 12, scale them by 4 to 48x32 coordinates.
  for (const page of sorted) {
    let migrated = false;
    if (page.blocks.length > 0 && page.blocks.every((b) => b.w <= 12 && b.x <= 12)) {
      for (const block of page.blocks) {
        block.x = Math.round(block.x * 4);
        block.y = Math.round(block.y * 4);
        block.w = Math.round(block.w * 4);
        block.h = Math.round(block.h * 4);
      }
      migrated = true;
    }
    if (migrated) {
      await db.put('page', page);
    }
  }

  return sorted;
}

export async function putPage(page: Page): Promise<void> {
  const db = await getDB();
  await db.put('page', page);
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('page', id);
}

export async function deleteProjectPages(projectId: string): Promise<void> {
  const db = await getDB();
  const keys = (await db.getAllKeysFromIndex('page', 'projectId', projectId)) as string[];
  const tx = db.transaction('page', 'readwrite');
  for (const k of keys) await tx.store.delete(k);
  await tx.done;
}

// ---------- Style groups ----------

export async function listStyleGroups(): Promise<StyleGroup[]> {
  const db = await getDB();
  const all = (await db.getAll('styleGroup')) as StyleGroup[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createStyleGroup(name: string): Promise<StyleGroup> {
  const db = await getDB();
  const group: StyleGroup = { id: uid(), name, createdAt: Date.now() };
  await db.put('styleGroup', group);
  return group;
}

export async function renameStyleGroup(id: string, name: string): Promise<void> {
  const db = await getDB();
  const g = (await db.get('styleGroup', id)) as StyleGroup | undefined;
  if (g) await db.put('styleGroup', { ...g, name });
}

export async function deleteStyleGroup(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['styleGroup', 'image'], 'readwrite');
  await tx.objectStore('styleGroup').delete(id);
  const keys = (await tx.objectStore('image').index('styleGroupId').getAllKeys(id)) as string[];
  for (const k of keys) { const img = await tx.objectStore('image').get(k); if (img) { img.styleGroupId = null; await tx.objectStore('image').put(img); } }
  await tx.done;
}

// ---------- Settings ----------

export async function getSettings(): Promise<UserSettings> {
  const db = await getDB();
  const s = (await db.get('userSettings', 'settings')) as UserSettings | undefined;
  return s ?? { id: 'settings', savedEmail: null };
}

export async function saveEmail(email: string | null): Promise<void> {
  const db = await getDB();
  await db.put('userSettings', { id: 'settings', savedEmail: email } satisfies UserSettings);
}




