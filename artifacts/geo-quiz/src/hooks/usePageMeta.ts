import { useEffect } from "react";

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
  "Play world geography quizzes and short courses covering capitals, countries, landmarks, and regions.";

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

function defaultOgImage(): string {
  return `${origin()}/opengraph.jpg`;
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
    canonical = window.location.href,
    ogImage = defaultOgImage(),
    ogType = "website",
    twitterCard = "summary_large_image",
  } = opts;

  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;

  document.title = fullTitle;
  setMetaName("description", description);
  setCanonical(canonical);

  setMetaProperty("og:type", ogType);
  setMetaProperty("og:site_name", SITE_NAME);
  setMetaProperty("og:title", fullTitle);
  setMetaProperty("og:description", description);
  setMetaProperty("og:url", canonical);
  setMetaProperty("og:image", ogImage);

  setMetaName("twitter:card", twitterCard);
  setMetaName("twitter:title", fullTitle);
  setMetaName("twitter:description", description);
  setMetaName("twitter:image", ogImage);
}

function resetToDefaults() {
  const canonical = origin() + "/";
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
