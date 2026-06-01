import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type Executor = Pick<typeof db, "select">;

export async function uniqueSlugWith(
  executor: Executor,
  base: string,
  excludeId?: number
): Promise<string> {
  const baseSlug = base || "category";
  let candidate = baseSlug;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await executor
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, candidate));
    const conflict = existing.find((c) => c.id !== excludeId);
    if (!conflict) return candidate;
    candidate = `${baseSlug}-${n++}`;
  }
}

export function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  return uniqueSlugWith(db, base, excludeId);
}

export function uniqueSlugTx(executor: Executor, base: string, excludeId?: number): Promise<string> {
  return uniqueSlugWith(executor, base, excludeId);
}
