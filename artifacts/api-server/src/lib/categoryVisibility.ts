import { db, categoriesTable } from "@workspace/db";

export type CategoryRow = typeof categoriesTable.$inferSelect;

/**
 * A category is visible to a non-admin only when it is published AND every
 * ancestor is published. This prunes whole draft subtrees so a published child
 * of a draft parent never surfaces (as an orphan root, a breadcrumb, a chip, or
 * a directly-addressable page).
 */
export function isCategoryVisible(
  c: CategoryRow,
  byId: Map<number, CategoryRow>,
): boolean {
  let cur: CategoryRow | undefined = c;
  const seen = new Set<number>();
  while (cur) {
    if (!cur.published) return false;
    if (cur.parentId === null) return true;
    if (seen.has(cur.id)) return true;
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
  }
  return true;
}

/** Build the set of category ids a non-admin may see from a full category list. */
export function buildVisibleCategoryIds(all: CategoryRow[]): Set<number> {
  const byId = new Map(all.map((c) => [c.id, c]));
  const visible = new Set<number>();
  for (const c of all) {
    if (isCategoryVisible(c, byId)) visible.add(c.id);
  }
  return visible;
}

/**
 * Returns the visible category id set for non-admins, or `null` for admins
 * (meaning "no restriction"). Fetches the full category list only when needed.
 */
export async function getVisibleCategoryIds(
  admin: boolean,
): Promise<Set<number> | null> {
  if (admin) return null;
  const all = await db.select().from(categoriesTable);
  return buildVisibleCategoryIds(all);
}
