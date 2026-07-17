// Split the de-duplicated "Map Skills and Coordinates" quiz (id 30, 40
// questions) into four engagement-sized, themed quizzes of ten, mirroring the
// biomes and capitals splits.
//
// Question content is copied verbatim from the source, so the split cannot
// introduce errors; a set check confirms the four quizzes reconstruct the
// source exactly. One content edit is applied: the GPS question's fun fact is
// expanded to note GPS is the United States' system and GNSS is the umbrella
// term (GLONASS, Galileo, BeiDou).
//
// Each quiz gets a balanced answer spread (even target positions, scrambled
// deterministically) and is attached to the empty "Map Skills and Coordinates"
// browse category. New quizzes are UNPUBLISHED; the source quiz is left intact
// — delete it once you're happy with the four. Idempotent (matched by title).
//   pnpm --filter @workspace/scripts run split-mapskills-quiz

import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  quizzesTable,
  questionsTable,
  categoriesTable,
  quizCategoriesTable,
  questionCategoriesTable,
} from "@workspace/db";

const SOURCE_QUIZ_ID = 30;
const CATEGORY_SLUG = "map-skills-and-coordinates";
const CATEGORY_TEXT = "Map Skills and Coordinates";

type Fix = { matchText: string; funFact: string };
const FIXES: Fix[] = [
  {
    matchText: "what does gps stand for",
    funFact:
      "GPS is specifically the United States' system. The umbrella term is GNSS " +
      "(Global Navigation Satellite System), which also covers Russia's GLONASS, " +
      "Europe's Galileo, and China's BeiDou — your phone often uses several at once.",
  },
];

type Spec = {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  sourceOrders: number[];
};

const SPECS: Spec[] = [
  {
    title: "Reading a Map: Tools & Symbols",
    description:
      "The essentials of reading any map — the legend, scale, compass rose, cardinal directions, and the symbols that decode it.",
    difficulty: "easy",
    sourceOrders: [35, 25, 26, 2, 4, 24, 3, 13, 39, 19],
  },
  {
    title: "Types of Maps",
    description:
      "Physical, political, thematic, topographic and more — plus the Mercator projection and how different maps show different things.",
    difficulty: "medium",
    sourceOrders: [8, 27, 36, 9, 0, 28, 11, 10, 12, 34],
  },
  {
    title: "Latitude, Longitude & Coordinates",
    description:
      "Latitude and longitude, the poles and the Prime Meridian, grid references, and how GPS pins a location.",
    difficulty: "medium",
    sourceOrders: [22, 23, 14, 30, 31, 32, 6, 7, 29, 38],
  },
  {
    title: "Lines & Zones of the Globe",
    description:
      "The imaginary lines that organize the globe — the Equator and tropics, the polar circles, the Prime Meridian and the Date Line.",
    difficulty: "medium",
    sourceOrders: [21, 20, 5, 33, 15, 16, 17, 18, 1, 37],
  },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/\?+$/, "");

function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function balancedTargets(seedText: string, n: number): number[] {
  const targets = Array.from({ length: n }, (_, i) => i % 4);
  const rng = mulberry32(hashSeed(seedText));
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  return targets;
}
function placeCorrect(options: string[], correctOption: number, targetPos: number) {
  const correctText = options[correctOption];
  const others = options.filter((_, idx) => idx !== correctOption);
  const out: string[] = [];
  let oi = 0;
  for (let p = 0; p < options.length; p++) out[p] = p === targetPos ? correctText : others[oi++];
  return { options: out, correctOption: targetPos };
}

function validateSpecs(sourceOrders: number[]): void {
  const used = SPECS.flatMap((s) => s.sourceOrders);
  const problems: string[] = [];
  for (const s of SPECS) {
    if (s.sourceOrders.length < 9 || s.sourceOrders.length > 12) {
      problems.push(`"${s.title}" has ${s.sourceOrders.length} questions (want ~10)`);
    }
  }
  if (new Set(used).size !== used.length) problems.push("a source order is used in more than one quiz");
  const covered = new Set(used);
  for (const o of sourceOrders) if (!covered.has(o)) problems.push(`source order ${o} is not used`);
  for (const o of used) if (!sourceOrders.includes(o)) problems.push(`used order ${o} does not exist in source`);
  if (problems.length) throw new Error("Split spec invalid:\n  - " + problems.join("\n  - "));
}

async function main(): Promise<void> {
  const source = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, SOURCE_QUIZ_ID))
    .orderBy(asc(questionsTable.orderIndex));
  validateSpecs(source.map((q) => q.orderIndex));
  const byOrder = new Map(source.map((q) => [q.orderIndex, q]));

  const tagRows = await db
    .select({ questionId: questionCategoriesTable.questionId, categoryId: questionCategoriesTable.categoryId })
    .from(questionCategoriesTable)
    .where(inArray(questionCategoriesTable.questionId, source.map((q) => q.id)));
  const tagsByQid = new Map<number, number[]>();
  for (const t of tagRows) (tagsByQid.get(t.questionId) ?? tagsByQid.set(t.questionId, []).get(t.questionId)!).push(t.categoryId);

  const [category] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, CATEGORY_SLUG));
  if (!category) throw new Error(`Category "${CATEGORY_SLUG}" not found.`);

  let created = 0;
  let skipped = 0;
  let fixesApplied = 0;

  for (const spec of SPECS) {
    const [existing] = await db
      .select({ id: quizzesTable.id })
      .from(quizzesTable)
      .where(eq(quizzesTable.title, spec.title));
    if (existing) {
      console.log(`  skip   "${spec.title}" — already present (id ${existing.id})`);
      skipped++;
      continue;
    }

    const spread = [0, 0, 0, 0];
    await db.transaction(async (tx) => {
      const [quiz] = await tx
        .insert(quizzesTable)
        .values({
          title: spec.title,
          description: spec.description,
          category: CATEGORY_TEXT,
          difficulty: spec.difficulty,
          published: false,
        })
        .returning({ id: quizzesTable.id });

      const targets = balancedTargets(spec.title, spec.sourceOrders.length);
      const rows = spec.sourceOrders.map((order, i) => {
        const src = byOrder.get(order);
        if (!src) throw new Error(`Source order ${order} missing`);
        const s = placeCorrect(src.options, src.correctOption, targets[i]);
        if (s.options[s.correctOption] !== src.options[src.correctOption]) {
          throw new Error(`Placement corrupted answer for: ${src.text}`);
        }
        spread[s.correctOption]++;

        let funFact = src.funFact;
        for (const fix of FIXES) {
          if (norm(src.text) === fix.matchText) {
            funFact = fix.funFact;
            fixesApplied++;
          }
        }
        return {
          quizId: quiz.id,
          text: src.text,
          options: s.options,
          correctOption: s.correctOption,
          explanation: src.explanation,
          funFact,
          imageUrl: src.imageUrl,
          orderIndex: i,
          srcId: src.id,
        };
      });
      const inserted = await tx
        .insert(questionsTable)
        .values(rows.map(({ srcId, ...r }) => r))
        .returning({ id: questionsTable.id });

      const tagLinks: { questionId: number; categoryId: number }[] = [];
      rows.forEach((r, i) => {
        for (const catId of tagsByQid.get(r.srcId) ?? []) tagLinks.push({ questionId: inserted[i].id, categoryId: catId });
      });
      if (tagLinks.length) await tx.insert(questionCategoriesTable).values(tagLinks);

      await tx.insert(quizCategoriesTable).values({ quizId: quiz.id, categoryId: category.id });
    });

    console.log(
      `  create "${spec.title}" (${spec.difficulty}, ${spec.sourceOrders.length} questions, spread A/B/C/D ${spread.join("/")}, unpublished)`,
    );
    created++;
  }

  if (created > 0 && fixesApplied !== FIXES.length) {
    throw new Error(`Applied ${fixesApplied} content fixes, expected ${FIXES.length}.`);
  }
  console.log(
    `\nQuizzes: ${created} created, ${skipped} already present.` +
      (created > 0 ? ` ${fixesApplied} fun-fact edit applied. New quizzes UNPUBLISHED, in the Map Skills and Coordinates category.` : ""),
  );
}

main()
  .catch((err) => {
    console.error("split-mapskills-quiz failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
