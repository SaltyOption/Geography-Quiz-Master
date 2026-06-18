import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Guards against a silent production regression: the <picture> elements rendered
// by ResponsiveImage (and the SSR builder in api-server) point at pre-generated
// responsive variants of every /regions/* and /landmarks/* source image. A
// <picture> does NOT fall back to its <img> when a chosen <source> 404s — it
// shows a broken image. So any new source image (or a regenerated one) that is
// missing its variants would silently break in modern browsers.
//
// This check fails if any source file under public/regions or public/landmarks
// is missing one of its generated siblings. Run `pnpm run optimize-images` to
// regenerate after adding or replacing a source image.
//
// The widths/formats MUST match the generator (optimize-images.mjs) and the
// consumers (src/components/ResponsiveImage.tsx, api-server ssr-pages.ts).
const OPTIMIZED_WIDTHS = [400, 768, 1024];
const OPTIMIZED_FORMATS = ["webp", "avif"] as const;
const DIRS = ["regions", "landmarks"];
const SOURCE_EXT = new Set([".png", ".jpg", ".jpeg"]);

const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "public");

function sourceImages(dir: string): string[] {
  const absDir = path.join(PUBLIC_DIR, dir);
  if (!existsSync(absDir)) return [];
  return readdirSync(absDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    if (!SOURCE_EXT.has(ext)) return false;
    // Skip anything that already looks like a generated variant (name-<width>).
    const stem = path.basename(file, path.extname(file));
    return !/-\d+$/.test(stem);
  });
}

function expectedSiblings(dir: string, file: string): string[] {
  const absDir = path.join(PUBLIC_DIR, dir);
  const stem = path.basename(file, path.extname(file));
  const siblings: string[] = [];
  for (const w of OPTIMIZED_WIDTHS) {
    for (const fmt of OPTIMIZED_FORMATS) {
      siblings.push(path.join(absDir, `${stem}-${w}.${fmt}`));
    }
  }
  return siblings;
}

describe("responsive image variants", () => {
  for (const dir of DIRS) {
    const sources = sourceImages(dir);

    it(`finds at least one source image in public/${dir}`, () => {
      expect(sources.length).toBeGreaterThan(0);
    });

    for (const file of sources) {
      it(`public/${dir}/${file} has all ${OPTIMIZED_WIDTHS.length * OPTIMIZED_FORMATS.length} responsive variants`, () => {
        const missing = expectedSiblings(dir, file)
          .filter((p) => !existsSync(p))
          .map((p) => path.relative(PUBLIC_DIR, p));
        expect(
          missing,
          `Missing generated variants for public/${dir}/${file}. ` +
            `Run \`pnpm run optimize-images\` to generate them.`,
        ).toEqual([]);
      });
    }
  }
});
