import type { ImgHTMLAttributes } from "react";

// Widths and naming convention MUST match optimize-images.mjs (the generator)
// and the SSR builder in artifacts/api-server/src/routes/ssr-pages.ts.
const OPTIMIZED_WIDTHS = [400, 1024];
// Only locally-hosted images under these prefixes have pre-generated variants.
const OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];

function withBase(url: string): string {
  return url.startsWith("/") ? `${import.meta.env.BASE_URL}${url.slice(1)}` : url;
}

function srcSetFor(rawPath: string, format: "avif" | "webp"): string {
  const dot = rawPath.lastIndexOf(".");
  const stem = rawPath.slice(0, dot);
  return OPTIMIZED_WIDTHS.map((w) => `${withBase(`${stem}-${w}.${format}`)} ${w}w`).join(", ");
}

type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  alt: string;
  sizes?: string;
};

/**
 * Renders a <picture> with AVIF + WebP responsive sources for locally-hosted
 * category/landmark images (which have pre-generated variants), falling back to
 * the original file. For any other src (e.g. external CDN URLs) it renders a
 * plain <img>. Uses display:contents so the inner <img> keeps its own layout.
 */
export function ResponsiveImage({ src, alt, sizes, className, ...imgProps }: ResponsiveImageProps) {
  const fallbackSrc = withBase(src);
  const optimizable = OPTIMIZED_PREFIXES.some((p) => src.startsWith(p));

  if (!optimizable) {
    return <img src={fallbackSrc} alt={alt} className={className} {...imgProps} />;
  }

  return (
    <picture className="contents">
      <source type="image/avif" srcSet={srcSetFor(src, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSetFor(src, "webp")} sizes={sizes} />
      <img src={fallbackSrc} alt={alt} className={className} {...imgProps} />
    </picture>
  );
}
