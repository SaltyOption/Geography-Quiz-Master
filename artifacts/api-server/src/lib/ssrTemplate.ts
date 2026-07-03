/**
 * SSR template utilities — mirrors the head-injection logic in prerender.mjs
 * but runs at request time so crawlers always receive fresh content.
 *
 * The template is the frontend's empty-root SPA shell. In production it ships
 * inside this server's own bundle as `web-template.html` (copied by build.mjs),
 * resolved relative to the running bundle — this is required because on the
 * autoscale deployment the geo-quiz static files live in a separate static
 * layer that is NOT present in this process's container. As a dev/local
 * fallback we read the frontend build output directly. If neither exists the
 * helpers fall back to a minimal self-contained HTML page that still contains
 * all the important SEO meta tags (but no JS bundle, so it stays unstyled —
 * which is why the bundled template must be present in production).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getMetaDescription } from "@workspace/seo-content";
import { SITE_NAME, esc } from "@workspace/ssr-bodies";

// Primary (production): the full frontend build (including the SPA shell) is
// copied next to the running bundle by build.mjs. esbuild bundles this module
// into dist/index.mjs, so import.meta.url resolves to the dist dir regardless of
// the process CWD; the build output therefore lives at dist/public.
const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url));
export const BUNDLED_PUBLIC_DIR = resolve(BUNDLE_DIR, "public");
const BUNDLED_TEMPLATE_PATH = resolve(BUNDLED_PUBLIC_DIR, "spa-template.html");

// Fallback (dev / local prod-like runs): read the frontend build output
// directly from the workspace tree.
const FRONTEND_TEMPLATE_PATH = resolve(
  process.cwd(),
  "artifacts/geo-quiz/dist/public/spa-template.html",
);

let _template: string | null = null;

/** Load (and cache) the built frontend SPA shell template. */
function getTemplate(): string | null {
  if (_template !== null) return _template;
  for (const candidate of [BUNDLED_TEMPLATE_PATH, FRONTEND_TEMPLATE_PATH]) {
    if (existsSync(candidate)) {
      _template = readFileSync(candidate, "utf-8");
      break;
    }
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

export interface PageMeta {
  title: string;
  description: string;
  path: string;
}

/** Serialize one or more JSON-LD objects into a single <script> tag. */
function buildJsonLdTag(jsonLd: object | object[]): string {
  const payload = Array.isArray(jsonLd) && jsonLd.length === 1 ? jsonLd[0] : jsonLd;
  return `<script id="json-ld-structured-data" type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

/** Build a nav-only fallback HTML page (no template available). */
function buildFallbackHtml(
  meta: PageMeta,
  bodyHtml: string,
  jsonLd?: object | object[],
): string {
  meta = {
    ...meta,
    description: getMetaDescription(meta.path) ?? meta.description,
  };
  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const fullTitle =
    meta.title === SITE_NAME ? meta.title : `${meta.title} | ${SITE_NAME}`;
  const canonical = domain ? `${domain}${meta.path}` : "";
  const ogImage = domain ? `${domain}/opengraph.jpg` : "";
  const jsonLdTag = jsonLd ? `\n  ${buildJsonLdTag(jsonLd)}` : "";

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
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(fullTitle)}" />
  <meta name="twitter:description" content="${esc(meta.description)}" />
  ${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}" />` : ""}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />${jsonLdTag}
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
 *
 * Pass `jsonLd` to inject one or more JSON-LD objects as a
 * `<script type="application/ld+json">` tag in `<head>`. The tag uses the same
 * element ID as the client-side `useJsonLd()` hook so React updates the existing
 * tag on hydration instead of duplicating it.
 */
export function buildPageHtml(
  meta: PageMeta,
  bodyHtml: string,
  jsonLd?: object | object[],
): string {
  const template = getTemplate();
  meta = {
    ...meta,
    description: getMetaDescription(meta.path) ?? meta.description,
  };
  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const fullTitle =
    meta.title === SITE_NAME ? meta.title : `${meta.title} | ${SITE_NAME}`;
  const canonical = domain ? `${domain}${meta.path}` : "";
  const ogImage = domain ? `${domain}/opengraph.jpg` : "";

  if (!template) {
    return buildFallbackHtml(meta, bodyHtml, jsonLd);
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

  // Inject og:locale if the template doesn't already have it
  if (!html.includes('property="og:locale"')) {
    html = html.replace(
      /(<meta\s+name="twitter:card")/,
      `<meta property="og:locale" content="en_US" />\n    $1`,
    );
  }

  // Inject JSON-LD into <head> before </head>, using the same element ID as
  // useJsonLd() so React hydration finds and updates rather than duplicates.
  if (jsonLd) {
    const tag = buildJsonLdTag(jsonLd);
    // Replace any existing json-ld tag if present, otherwise inject before </head>
    if (html.includes('id="json-ld-structured-data"')) {
      html = html.replace(
        /<script id="json-ld-structured-data"[^>]*>[\s\S]*?<\/script>/,
        tag,
      );
    } else {
      html = html.replace("</head>", `${tag}\n</head>`);
    }
  }

  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${bodyHtml}</div>`,
  );

  return html;
}
