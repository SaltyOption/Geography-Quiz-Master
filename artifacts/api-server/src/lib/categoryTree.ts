/**
 * Category-tree traversal helpers shared by every route that needs
 * descendant-inclusive category queries (categories, questions, ssr-pages).
 */

/**
 * Collect the ids of every descendant of `rootId` (BFS over the flat category
 * list; the root itself is not included).
 */
export function collectDescendantIds(
  rootId: number,
  all: { id: number; parentId: number | null }[],
): number[] {
  const descendantIds: number[] = [];
  const queue: number[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of all) {
      if (c.parentId === id) {
        descendantIds.push(c.id);
        queue.push(c.id);
      }
    }
  }
  return descendantIds;
}
