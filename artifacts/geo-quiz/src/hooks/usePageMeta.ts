import { useEffect } from "react";
import { getMetaDescription } from "@workspace/seo-content";

export interface PageMetaOptions {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image";
}

const SITE_NAME = "World Geography Trivia";
const DEFAULT_DESCRIPTION =
  getMetaDescription("/") ??
  "Play world geography quizzes and short courses covering capitals, countries, landmarks, and regions.";

/**
 * Returns the canonical origin for this site.
 *
 * Reads `VITE_CANONICAL_DOMAIN` first — the same env var that `prerender.mjs`
 * uses to embed canonical/og:url tags in the static HTML.  This ensures the
 * client never overwrites a prerendered production canonical with whatever
 * hostname the visitor happened to use (e.g. a preview or staging URL).
 *
 * Falls back to `window.location.origin` only when the env var is absent so
 * local development still works without configuration.
 */
export function canonicalOrigin(): string {
  const configured = import.meta.env.VITE_CANONICAL_DOMAIN as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}

function defaultOgImage(): string {
  return `${canonicalOrigin()}/opengraph.jpg`;
}

function setMetaName(name: string, content: string) {
  let el = document.querySelector(
    `meta[name="${name}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(
    `meta[property="${property}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector(
    `link[rel="canonical"]`,
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function applyMeta(opts: PageMetaOptions) {
  const {
    title,
    description,
    canonical = canonicalOrigin() +
      (typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : ""),
    ogImage = defaultOgImage(),
    ogType = "website",
    twitterCard = "summary_large_image",
  } = opts;

  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const metaDescription = getMetaDescription(pathname) ?? description;

  document.title = fullTitle;
  setMetaName("description", metaDescription);
  setCanonical(canonical);

  setMetaProperty("og:type", ogType);
  setMetaProperty("og:site_name", SITE_NAME);
  setMetaProperty("og:title", fullTitle);
  setMetaProperty("og:description", metaDescription);
  setMetaProperty("og:url", canonical);
  setMetaProperty("og:image", ogImage);

  setMetaName("twitter:card", twitterCard);
  setMetaName("twitter:title", fullTitle);
  setMetaName("twitter:description", metaDescription);
  setMetaName("twitter:image", ogImage);
}

function resetToDefaults() {
  const canonical = canonicalOrigin() + "/";
  const ogImage = defaultOgImage();

  document.title = SITE_NAME;
  setMetaName("description", DEFAULT_DESCRIPTION);
  setCanonical(canonical);

  setMetaProperty("og:type", "website");
  setMetaProperty("og:site_name", SITE_NAME);
  setMetaProperty("og:title", SITE_NAME);
  setMetaProperty("og:description", DEFAULT_DESCRIPTION);
  setMetaProperty("og:url", canonical);
  setMetaProperty("og:image", ogImage);

  setMetaName("twitter:card", "summary_large_image");
  setMetaName("twitter:title", SITE_NAME);
  setMetaName("twitter:description", DEFAULT_DESCRIPTION);
  setMetaName("twitter:image", ogImage);
}

export function usePageMeta(opts: PageMetaOptions | null | undefined) {
  useEffect(() => {
    if (!opts) return;
    applyMeta(opts);
    return () => {
      resetToDefaults();
    };
  }, [
    opts?.title,
    opts?.description,
    opts?.canonical,
    opts?.ogImage,
    opts?.ogType,
    opts?.twitterCard,
  ]);
}
