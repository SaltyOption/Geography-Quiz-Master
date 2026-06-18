import swallowAvif from "@assets/mascot_swallow.png?w=40;80;160;256;384;512&format=avif&as=srcset";
import swallowWebp from "@assets/mascot_swallow.png?w=40;80;160;256;384;512&format=webp&as=srcset";
import swallowFallback from "@assets/mascot_swallow.png?w=256&format=png&as=url";
import thinkingAvif from "@assets/mascot_swallow_thinking.png?w=80;96;112;160;192;224&format=avif&as=srcset";
import thinkingWebp from "@assets/mascot_swallow_thinking.png?w=80;96;112;160;192;224&format=webp&as=srcset";
import thinkingFallback from "@assets/mascot_swallow_thinking.png?w=192&format=png&as=url";

const VARIANTS = {
  default: { avif: swallowAvif, webp: swallowWebp, fallback: swallowFallback },
  thinking: { avif: thinkingAvif, webp: thinkingWebp, fallback: thinkingFallback },
} as const;

export type MascotVariant = keyof typeof VARIANTS;

interface MascotProps {
  /** Which mascot artwork to show. */
  variant?: MascotVariant;
  /** Accessible label. Pass an empty string for purely decorative usage. */
  alt: string;
  /** Utility classes applied to the underlying <img>. */
  className?: string;
  /** Tells the browser the rendered size so it can pick the smallest adequate source. */
  sizes: string;
  /** Loading strategy. Above-the-fold mascots should be "eager". */
  loading?: "lazy" | "eager";
  /** Mark the image decorative (aria-hidden) for screen readers. */
  ariaHidden?: boolean;
}

/**
 * Responsive, modern-format mascot image.
 *
 * Serves AVIF and WebP variants at multiple widths (selected via `sizes`) with a
 * small PNG fallback, so the browser downloads only the size it needs instead of
 * the full 1254x1254 source. The <picture> uses `display: contents` so the inner
 * <img> participates in the parent layout exactly as a bare <img> would.
 */
export function Mascot({
  variant = "default",
  alt,
  className,
  sizes,
  loading = "lazy",
  ariaHidden = false,
}: MascotProps) {
  const set = VARIANTS[variant];
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={set.avif} sizes={sizes} />
      <source type="image/webp" srcSet={set.webp} sizes={sizes} />
      <img
        src={set.fallback}
        alt={alt}
        aria-hidden={ariaHidden || undefined}
        width={256}
        height={256}
        loading={loading}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
