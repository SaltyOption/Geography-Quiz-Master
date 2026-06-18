// Single source of truth for the responsive image widths used to pre-generate
// and reference the static category/landmark image variants.
//
// Consumers (must all import from here, never hardcode the list):
//   - artifacts/geo-quiz/optimize-images.mjs            (generates variants)
//   - artifacts/geo-quiz/src/components/ResponsiveImage.tsx (srcset on client)
//   - artifacts/api-server/src/routes/ssr-pages.ts      (srcset in SSR HTML)
//
// Changing this list automatically updates every consumer, so generated files
// and the URLs that reference them can never drift out of sync.
export const RESPONSIVE_IMAGE_WIDTHS = [400, 768, 1024];
