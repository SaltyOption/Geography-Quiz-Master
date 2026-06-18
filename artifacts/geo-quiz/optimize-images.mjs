// Generates responsive, modern-format (WebP + AVIF) variants of the static
// category and landmark images that are referenced by URL from the database.
// These images live in public/ and are served verbatim, so vite-imagetools
// cannot transform them at build time — we pre-generate siblings instead.
//
// For each source like public/regions/ancient-sites.png we emit:
//   ancient-sites-400.webp  ancient-sites-1024.webp
//   ancient-sites-400.avif  ancient-sites-1024.avif
// The original is kept as the <img> fallback. Re-runnable / idempotent.
//
// The width list comes from the shared @workspace/image-config module so it
// stays in sync with the consumers: src/components/ResponsiveImage.tsx and the
// SSR builder in artifacts/api-server/src/routes/ssr-pages.ts. The naming
// convention here must still match those consumers.

import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { RESPONSIVE_IMAGE_WIDTHS } from "@workspace/image-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DIRS = ["regions", "landmarks"];
const WIDTHS = RESPONSIVE_IMAGE_WIDTHS;
const SOURCE_EXT = new Set([".png", ".jpg", ".jpeg"]);

async function run() {
  let generated = 0;
  for (const dir of DIRS) {
    const absDir = path.join(PUBLIC_DIR, dir);
    let files;
    try {
      files = await readdir(absDir);
    } catch {
      continue;
    }
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!SOURCE_EXT.has(ext)) continue;
      const stem = path.basename(file, path.extname(file));
      // Skip anything that already looks like a generated variant (name-<width>).
      if (/-\d+$/.test(stem)) continue;
      const input = path.join(absDir, file);
      // Resumable: skip variants that already exist. To regenerate after
      // replacing a source image, delete its existing -<width>.{webp,avif}
      // siblings first.
      for (const w of WIDTHS) {
        const webpOut = path.join(absDir, `${stem}-${w}.webp`);
        const avifOut = path.join(absDir, `${stem}-${w}.avif`);
        if (!existsSync(webpOut)) {
          await sharp(input)
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: 78 })
            .toFile(webpOut);
          generated += 1;
        }
        if (!existsSync(avifOut)) {
          await sharp(input)
            .resize({ width: w, withoutEnlargement: true })
            .avif({ quality: 50 })
            .toFile(avifOut);
          generated += 1;
        }
      }
      console.log(`optimized ${dir}/${file}`);
    }
  }
  console.log(`Done. Generated ${generated} variant files.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
