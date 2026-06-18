---
name: Responsive image variants for geo-quiz static assets
description: How DB-referenced /regions and /landmarks images are optimized, and the constraint that every such path must have pre-generated variants.
---

# Responsive image variants (geo-quiz)

DB-referenced static images under `public/regions/*.png` (category `imageUrl`)
and `public/landmarks/*.jpg` (question `image_url`) are served as pre-generated
responsive variants, not as the multi-MB originals.

- A build script (`artifacts/geo-quiz/optimize-images.mjs`, run via the
  `optimize-images` package script) emits sibling `-400`/`-1024` `.webp`+`.avif`
  variants. It is resumable (skips existing outputs), so to regenerate after
  replacing a source image you must delete its old variants first.
- The variants are committed into `public/` and served by BOTH the vite dev
  server and the api-server prod static layer (see ssr-template-bundling).
- The width/naming/prefix convention is duplicated across several files and must
  stay in sync: `optimize-images.mjs`, `src/components/ResponsiveImage.tsx`
  (client), api-server `src/routes/ssr-pages.ts` (runtime SSR), the maintenance
  script `scripts/src/check-db-image-files.ts`, and the api-server write-time
  guard `src/lib/imageValidation.ts`. Comments in each flag this.

**Constraint:** every DB value whose path starts with `/regions/` or
`/landmarks/` MUST have its four generated siblings present.

**Why:** a `<picture>` element does NOT fall back to its `<img>` when a chosen
`<source>` srcset entry 404s — it shows a broken image. So a new category/
question image added via the DB without running `optimize-images` breaks
silently in modern browsers (only legacy browsers using the `<img>` fallback
would still work).

**How to apply:** there is currently no image-upload pipeline (fixed seeded
set), so this is safe today. If an upload/admin-image flow is ever added, either
generate variants on upload or have `ResponsiveImage`/SSR fall back to a plain
`<img>` when variants are not known to exist. After adding any new
`/regions/` or `/landmarks/` source file, re-run `optimize-images`.
