/**
 * SSR template utilities — mirrors the head-injection logic in prerender.mjs
 * but runs at request time so crawlers always receive fresh content.
 *
 * At startup the built frontend index.html is read from
 * artifacts/geo-quiz/dist/public/index.html (relative to CWD, which is
 * the workspace root when the server starts via the production run command).
 * If the file is not found (e.g. a dev environment where the frontend has
 * not been built yet) the helpers fall back to a minimal self-contained
 * HTML page that still contains all the important SEO meta tags.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const SITE_NAME = "World Geography Trivia";
const FRONTEND_DIST = resolve(process.cwd(), "artifacts/geo-quiz/dist/public");
const TEMPLATE_PATH = resolve(FRONTEND_DIST, "index.html");

let _template: string | null = null;

/** Load (and cache) the built frontend index.html template. */
function getTemplate(): string | null {
  if (_template !== null) return _template;
  if (existsSync(TEMPLATE_PATH)) {
    _template = readFileSync(TEMPLATE_PATH, "utf-8");
  }
  return _template;
}

/**
 * Return the raw (unmodified) frontend SPA template, or null if unavailable.
 * Used by catch-all fallbacks to serve index.html for unmatched subroutes so
 * the React SPA can take over client-side (e.g. /quiz/1/results).
 */
export function getRawTemplate(): string | null {
  return getTemplate();
}

/** Minimal HTML-attribute and text escaping for injected values. */
export function esc(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface PageMeta {
  title: string;
  description: string;
  path: string;
}

/** Shared minimal nav for the crawlable body fallback. */
function sharedNav(): string {
  return `<header style="border-bottom:1px solid #e5e7eb;padding:0.75rem 1rem;background:#fff">
    <a href="/" style="font-weight:700;color:#0e7490;text-decoration:none">${esc(SITE_NAME)}</a>
  </header>`;
}

/** Build a nav-only fallback HTML page (no template available). */
function buildFallbackHtml(meta: PageMeta, bodyHtml: string): string {
  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const fullTitle =
    meta.title === SITE_NAME ? meta.title : `${meta.title} | ${SITE_NAME}`;
  const canonical = domain ? `${domain}${meta.path}` : "";
  const ogImage = domain ? `${domain}/opengraph.jpg` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(meta.description)}" />
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : ""}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${esc(SITE_NAME)}" />
  <meta property="og:title" content="${esc(fullTitle)}" />
  <meta property="og:description" content="${esc(meta.description)}" />
  ${canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : ""}
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(fullTitle)}" />
  <meta name="twitter:description" content="${esc(meta.description)}" />
  ${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}" />` : ""}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
<body>
  <div id="root">${bodyHtml}</div>
  <p style="display:none"><a href="/">Enable JavaScript for the full experience.</a></p>
</body>
</html>`;
}

/**
 * Build the full SSR HTML for a route.
 * Uses the prebuilt frontend template when available (preserving JS bundles for
 * SPA hydration), otherwise returns a minimal standalone page with all SEO tags.
 */
export function buildPageHtml(meta: PageMeta, bodyHtml: string): string {
  const template = getTemplate();
  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const fullTitle =
    meta.title === SITE_NAME ? meta.title : `${meta.title} | ${SITE_NAME}`;
  const canonical = domain ? `${domain}${meta.path}` : "";
  const ogImage = domain ? `${domain}/opengraph.jpg` : "";

  if (!template) {
    return buildFallbackHtml(meta, bodyHtml);
  }

  let html = template;

  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${esc(fullTitle)}</title>`,
  );
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${esc(meta.description)}$2`,
  );
  if (canonical) {
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
      `$1${esc(canonical)}$2`,
    );
    html = html.replace(
      /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
      `$1${esc(canonical)}$2`,
    );
  }
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${esc(fullTitle)}$2`,
  );
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${esc(meta.description)}$2`,
  );
  if (ogImage) {
    html = html.replace(
      /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
      `$1${esc(ogImage)}$2`,
    );
    html = html.replace(
      /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,
      `$1${esc(ogImage)}$2`,
    );
  }
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${esc(fullTitle)}$2`,
  );
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${esc(meta.description)}$2`,
  );

  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${bodyHtml}</div>`,
  );

  return html;
}

export { sharedNav };
