import type { ImageRec, Page, Project } from './types';
import { continuationBlocks, imageSlots, templateBlocks, uid } from './grid';

/**
 * "Create Moodboard": builds the initial document from a project's images.
 * Images fill the template's image slots in order; overflow spills onto new
 * pages using the continuation template. Existing text content is preserved
 * when regenerating is not requested (we simply rebuild from scratch here —
 * regeneration replaces the document by design).
 */
export function buildMoodboard(project: Project, images: ImageRec[]): Page[] {
  const pages: Page[] = [];
  const queue = [...images];

  const firstBlocks = templateBlocks(project.orientation);
  for (const slot of imageSlots(firstBlocks)) {
    const img = queue.shift();
    if (!img) break;
    slot.content = img.id;
  }
  pages.push({ id: uid(), projectId: project.id, order: 0, blocks: firstBlocks });

  while (queue.length > 0) {
    const blocks = continuationBlocks(project.orientation);
    for (const slot of imageSlots(blocks)) {
      const img = queue.shift();
      if (!img) break;
      slot.content = img.id;
    }
    pages.push({ id: uid(), projectId: project.id, order: pages.length, blocks });
  }

  return pages;
}
