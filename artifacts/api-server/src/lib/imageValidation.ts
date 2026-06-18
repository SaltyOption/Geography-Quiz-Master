/**
 * Write-time validation for locally-hosted image URLs.
 *
 * Admins can attach an image URL to a quiz question (and, via bulk import, to
 * many at once). When that URL points under one of the optimized prefixes
 * (/regions/, /landmarks/) the frontend renders a <picture> that expects
 * pre-generated responsive variants to exist. A <picture> does NOT fall back to
 * its <img> when a chosen <source> 404s, so a URL whose source file or variants
 * are missing renders as a broken image with no fallback.
 *
 * The maintenance script (scripts/src/check-db-image-files.ts) catches these
 * AFTER they are saved. This module performs the same file-existence check at
 * write time so the server can reject a bad reference up front and give the
 * admin immediate, actionable feedback.
 *
 * Keep OPTIMIZED_PREFIXES / OPTIMIZED_FORMATS and the variant naming in sync
 * with ResponsiveImage.tsx, ssr-pages.ts, and check-db-image-files.ts.
 */

import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RESPONSIVE_IMAGE_WIDTHS } from "@workspace/image-config";

export const OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];
const OPTIMIZED_FORMATS = ["webp", "avif"] as const;

// esbuild bundles this module into dist/index.mjs, so in production import.meta.url
// resolves to the dist dir and the frontend build copied next to it lives at
// dist/public (mirrors ssrTemplate.ts).
const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url));

// Candidate roots that may hold the hosted static files, most-likely first.
// The CWD varies (workspace root via `pnpm --filter`, the api-server package
// dir under vitest, or the bundle dir in production), so we probe several
// bundle- and CWD-relative locations:
// - production: the frontend build copied next to this server's bundle
// - dev (running from src): the frontend's committed source public/ dir,
//   resolved relative to this module (src/lib -> ../../../geo-quiz/public)
// - dev/local: the same dir relative to a few plausible CWDs
function candidatePublicDirs(): string[] {
  const cwd = process.cwd();
  return [
    // Production: frontend build copied next to the bundled server (dist/public).
    resolve(BUNDLE_DIR, "public"),
    // Dev running from source: src/lib -> artifacts/geo-quiz/public.
    resolve(BUNDLE_DIR, "../../../geo-quiz/public"),
    // CWD = workspace root.
    resolve(cwd, "artifacts/geo-quiz/public"),
    resolve(cwd, "artifacts/geo-quiz/dist/public"),
    // CWD = artifacts/api-server (e.g. `pnpm --filter` under vitest).
    resolve(cwd, "../geo-quiz/public"),
    resolve(cwd, "../geo-quiz/dist/public"),
    // CWD = artifacts.
    resolve(cwd, "geo-quiz/public"),
  ];
}

let _publicDir: string | null | undefined;
function resolvePublicDir(): string | null {
  if (_publicDir !== undefined) return _publicDir;
  _publicDir = candidatePublicDirs().find((d) => existsSync(d)) ?? null;
  return _publicDir;
}

function normalizePath(url: string): string {
  // Strip query string / fragment, then drop the leading slash so the path can
  // be resolved relative to the public dir.
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

/** True when a URL points under a prefix that requires hosted variants. */
export function isOptimizedImageUrl(url: string): boolean {
  return OPTIMIZED_PREFIXES.some((p) => url.startsWith(p));
}

/**
 * Return the list of files (relative to public/) that an optimized image URL
 * references but that are not hosted. Empty array means everything exists, the
 * URL is out of scope (external/CDN), or the public dir could not be located
 * (in which case we fail open rather than block all saves).
 */
export function findMissingImageFiles(url: string): string[] {
  if (!isOptimizedImageUrl(url)) return [];
  const publicDir = resolvePublicDir();
  if (!publicDir) return [];
  const relPath = normalizePath(url);
  const candidates = [relPath, ...expectedVariants(relPath)];
  return candidates.filter((rel) => !existsSync(join(publicDir, rel)));
}

export type ImageValidationError = { url: string; missing: string[] };

/**
 * Validate a single optional image URL. Returns an error object when the URL
 * points under an optimized prefix but its source file or responsive variants
 * are not hosted; null when valid, out of scope, or empty.
 */
export function validateOptionalImageUrl(
  url: string | null | undefined,
): ImageValidationError | null {
  if (url === null || url === undefined || url === "") return null;
  const missing = findMissingImageFiles(url);
  if (missing.length === 0) return null;
  return { url, missing };
}

/** Human-readable, actionable message for a failed image validation. */
export function imageValidationMessage(err: ImageValidationError): string {
  return (
    `Image not hosted: "${err.url}" is missing ${err.missing.length} file(s) ` +
    `(${err.missing.map((m) => `public/${m}`).join(", ")}). ` +
    `Upload the source image and regenerate its responsive variants, or correct the URL.`
  );
}
