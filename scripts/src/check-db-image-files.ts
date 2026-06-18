// Maintenance check: catch broken images that point to files we don't host.
//
// The filesystem-only test (artifacts/geo-quiz/src/image-variants.test.ts)
// verifies that every SOURCE image under public/regions and public/landmarks
// has its pre-generated responsive siblings. It does NOT verify the reverse:
// that the image URLs actually stored in the database point at files that exist.
//
// An admin can save a quiz question / category / course image URL under the
// /regions/ or /landmarks/ prefixes that has no underlying source file (or is
// missing its responsive variants). Because a <picture> does not fall back to
// its <img> when a chosen <source> 404s, this renders a broken image with no
// fallback. This script flags those rows so they can be fixed before users hit
// them.
//
// It is a maintenance/admin script (not a CI test) because the api-server test
// suite runs against a mocked database, so real DB access in CI is impractical.
// Run it against a real database (dev or production) with DATABASE_URL set:
//
//   pnpm --filter @workspace/scripts run check-db-image-files
//
// Exit code is non-zero when any referenced file is missing, so it can also be
// wired into a scheduled job or pre-deploy gate that has DB access.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isNotNull } from "drizzle-orm";
import {
  db,
  pool,
  questionsTable,
  categoriesTable,
  coursesTable,
} from "@workspace/db";
import { RESPONSIVE_IMAGE_WIDTHS } from "@workspace/image-config";

// Keep these in sync with ResponsiveImage.tsx / ssr-pages.ts: only locally
// hosted images under these prefixes have pre-generated responsive variants.
const OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];
const OPTIMIZED_FORMATS = ["webp", "avif"] as const;

// public/ lives in the geo-quiz frontend artifact; that is what the proxy
// serves these URLs from in production.
const PUBLIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "artifacts",
  "geo-quiz",
  "public",
);

type ImageRef = {
  source: string; // e.g. "questions" / "categories" / "courses"
  id: number;
  url: string;
};

function normalizePath(url: string): string {
  // Strip query string and fragment, then drop the leading slash so the path
  // can be resolved relative to PUBLIC_DIR.
  const withoutQuery = url.split(/[?#]/, 1)[0];
  return withoutQuery.replace(/^\/+/, "");
}

function expectedVariants(relPath: string): string[] {
  const dot = relPath.lastIndexOf(".");
  const stem = dot === -1 ? relPath : relPath.slice(0, dot);
  const variants: string[] = [];
  for (const w of RESPONSIVE_IMAGE_WIDTHS) {
    for (const fmt of OPTIMIZED_FORMATS) {
      variants.push(`${stem}-${w}.${fmt}`);
    }
  }
  return variants;
}

function missingFilesFor(url: string): string[] {
  const relPath = normalizePath(url);
  const candidates = [relPath, ...expectedVariants(relPath)];
  return candidates.filter(
    (rel) => !existsSync(path.join(PUBLIC_DIR, rel)),
  );
}

async function collectImageRefs(): Promise<ImageRef[]> {
  const [questions, categories, courses] = await Promise.all([
    db
      .select({ id: questionsTable.id, url: questionsTable.imageUrl })
      .from(questionsTable)
      .where(isNotNull(questionsTable.imageUrl)),
    db
      .select({ id: categoriesTable.id, url: categoriesTable.imageUrl })
      .from(categoriesTable)
      .where(isNotNull(categoriesTable.imageUrl)),
    db
      .select({ id: coursesTable.id, url: coursesTable.imageUrl })
      .from(coursesTable)
      .where(isNotNull(coursesTable.imageUrl)),
  ]);

  const refs: ImageRef[] = [];
  for (const row of questions)
    refs.push({ source: "questions", id: row.id, url: row.url as string });
  for (const row of categories)
    refs.push({ source: "categories", id: row.id, url: row.url as string });
  for (const row of courses)
    refs.push({ source: "courses", id: row.id, url: row.url as string });
  return refs;
}

async function main(): Promise<void> {
  const refs = await collectImageRefs();

  // Only URLs under the optimized prefixes are expected to be locally hosted
  // with responsive variants. External/CDN URLs render a plain <img> and are
  // out of scope here.
  const localRefs = refs.filter((ref) =>
    OPTIMIZED_PREFIXES.some((p) => ref.url.startsWith(p)),
  );

  const broken: Array<ImageRef & { missing: string[] }> = [];
  for (const ref of localRefs) {
    const missing = missingFilesFor(ref.url);
    if (missing.length > 0) broken.push({ ...ref, missing });
  }

  console.log(
    `Checked ${localRefs.length} DB image URL(s) under ${OPTIMIZED_PREFIXES.join(
      ", ",
    )} (out of ${refs.length} total non-null image URL(s)).`,
  );

  if (broken.length === 0) {
    console.log("OK: every referenced source file and responsive variant exists.");
    return;
  }

  console.error(
    `\nFOUND ${broken.length} DB image URL(s) pointing at files we don't host:`,
  );
  for (const ref of broken) {
    console.error(`\n  ${ref.source}#${ref.id} -> ${ref.url}`);
    for (const rel of ref.missing) {
      console.error(`    missing: public/${rel}`);
    }
  }
  console.error(
    "\nFix by uploading the source image and running `pnpm --filter @workspace/geo-quiz run optimize-images`, " +
      "or by correcting the stored image URL.",
  );
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("check-db-image-files failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
