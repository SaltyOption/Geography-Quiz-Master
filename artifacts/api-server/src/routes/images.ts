import { Router, type IRouter } from "express";
import { isNotNull } from "drizzle-orm";
import {
  db,
  questionsTable,
  categoriesTable,
  coursesTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  isOptimizedImageUrl,
  isExternalImageUrl,
  findMissingImageFiles,
  imageValidationMessage,
  listHostedOptimizedImages,
} from "../lib/imageValidation";
import {
  checkExternalImageUrl,
  mapWithConcurrency,
  EXTERNAL_CONCURRENCY,
} from "@workspace/image-check";

const router: IRouter = Router();

/**
 * Admin-only pre-flight check for an image URL. Mirrors the write-time guard
 * (validateImageUrlReachable) so the admin forms can warn inline, while an admin
 * still types, that an image is not hosted (optimized /regions/, /landmarks/
 * URLs and their responsive variants) or that an external URL does not resolve
 * to a reachable image — before they hit Save and get a 400. The server-side
 * 400 on save remains the authoritative guard.
 *
 * `reachable` is tri-state: true (external URL resolved to an image), false
 * (external URL is genuinely broken), or null (not checked, or only transiently
 * unreachable — transient failures must not block a save).
 */
router.get("/images/validate", requireAdmin, async (req, res): Promise<void> => {
  const raw = req.query.url;
  const url = Array.isArray(raw) ? raw[0] : raw;
  if (typeof url !== "string" || url === "") {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  const optimized = isOptimizedImageUrl(url);
  const missing = optimized ? findMissingImageFiles(url) : [];

  if (missing.length > 0) {
    res.json({
      optimized,
      missing,
      reachable: null,
      message: imageValidationMessage({ kind: "local-missing", url, missing }),
    });
    return;
  }

  // Not a broken local image — check external reachability when applicable.
  let reachable: boolean | null = null;
  let message: string | null = null;
  if (!optimized && isExternalImageUrl(url)) {
    const result = await checkExternalImageUrl(url);
    if (result.status === "ok") {
      reachable = true;
    } else if (result.status === "broken") {
      reachable = false;
      message = imageValidationMessage({
        kind: "external-unreachable",
        url,
        reason: result.reason,
      });
    }
    // "transient" leaves reachable=null / message=null — never block on it.
  }

  res.json({ optimized, missing, reachable, message });
});

/**
 * Admin-only gallery of the locally hosted optimized images (under /regions/
 * and /landmarks/) that have all of their responsive variants on disk. Powers
 * the visual image picker on the admin forms so admins can pick a guaranteed-
 * hosted cover image instead of typing a raw path.
 */
router.get("/images/gallery", requireAdmin, (_req, res): void => {
  res.json({ groups: listHostedOptimizedImages() });
});

type ImageRef = {
  source: "question" | "category" | "course";
  id: number;
  url: string;
  label: string;
  quizId: number | null;
  slug: string | null;
};

type BrokenItem = ImageRef & { reason: string };

/** Truncate a long label so it stays readable in the admin list. */
function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function collectImageRefs(): Promise<ImageRef[]> {
  const [questions, categories, courses] = await Promise.all([
    db
      .select({
        id: questionsTable.id,
        url: questionsTable.imageUrl,
        text: questionsTable.text,
        quizId: questionsTable.quizId,
      })
      .from(questionsTable)
      .where(isNotNull(questionsTable.imageUrl)),
    db
      .select({
        id: categoriesTable.id,
        url: categoriesTable.imageUrl,
        name: categoriesTable.name,
      })
      .from(categoriesTable)
      .where(isNotNull(categoriesTable.imageUrl)),
    db
      .select({
        id: coursesTable.id,
        url: coursesTable.imageUrl,
        title: coursesTable.title,
        slug: coursesTable.slug,
      })
      .from(coursesTable)
      .where(isNotNull(coursesTable.imageUrl)),
  ]);

  const refs: ImageRef[] = [];
  for (const row of questions)
    refs.push({
      source: "question",
      id: row.id,
      url: row.url as string,
      label: truncate(row.text),
      quizId: row.quizId,
      slug: null,
    });
  for (const row of categories)
    refs.push({
      source: "category",
      id: row.id,
      url: row.url as string,
      label: row.name,
      quizId: null,
      slug: null,
    });
  for (const row of courses)
    refs.push({
      source: "course",
      id: row.id,
      url: row.url as string,
      label: row.title,
      quizId: null,
      slug: row.slug,
    });
  return refs;
}

/**
 * Admin-only cleanup scan: run the same reachability check used at write-time
 * and by the scheduled job across EVERY stored image URL (questions,
 * categories, courses), so admins can find and fix links that were saved before
 * write-time validation existed. Local optimized URLs (/regions/, /landmarks/)
 * are checked for their source file and responsive variants on disk; external
 * http(s) URLs are checked for reachability. Only genuinely broken links are
 * reported — transient failures (timeout / DNS / 5xx / 429) are counted but
 * never reported as broken, mirroring the script and write-time guard.
 */
router.get("/images/scan", requireAdmin, async (_req, res): Promise<void> => {
  const refs = await collectImageRefs();

  // Optimized local URLs: verify the source file and every responsive variant
  // exists on disk (synchronous, no network).
  const localRefs = refs.filter((ref) => isOptimizedImageUrl(ref.url));
  // External / CDN URLs: verify they resolve to a reachable image.
  const externalRefs = refs.filter(
    (ref) => !isOptimizedImageUrl(ref.url) && isExternalImageUrl(ref.url),
  );

  const broken: BrokenItem[] = [];

  for (const ref of localRefs) {
    const missing = findMissingImageFiles(ref.url);
    if (missing.length > 0) {
      broken.push({
        ...ref,
        reason: `missing ${missing.length} hosted file(s): ${missing
          .map((m) => `public/${m}`)
          .join(", ")}`,
      });
    }
  }

  const externalChecked = await mapWithConcurrency(
    externalRefs,
    EXTERNAL_CONCURRENCY,
    async (ref) => ({ ref, result: await checkExternalImageUrl(ref.url) }),
  );

  let transientCount = 0;
  for (const { ref, result } of externalChecked) {
    if (result.status === "broken") {
      broken.push({ ...ref, reason: result.reason });
    } else if (result.status === "transient") {
      transientCount += 1;
    }
  }

  res.json({
    scanned: refs.length,
    brokenCount: broken.length,
    transientCount,
    broken,
  });
});

export default router;
