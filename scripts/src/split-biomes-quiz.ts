// Split the 40-question "Climate and Biomes" quiz (id 31) into four focused,
// engagement-sized quizzes of 10 questions each, grouped by theme.
//
// Question content is COPIED verbatim from quiz 31 (the already-reviewed,
// de-duplicated source), so the split cannot introduce typos or answer errors.
// The grouping is by quiz-31 orderIndex; the guard below asserts the four
// groups partition 0..39 exactly (each question used once, ten per quiz).
//
// The source quiz has 38 of 40 correct answers sitting at position A — a
// trivially gameable "always pick the first option" pattern. Each question's
// options are therefore shuffled with a DETERMINISTIC per-question permutation
// (seeded from the question text), which redistributes answers across A-D while
// keeping the script reproducible and idempotent.
//
// The new quizzes are created UNPUBLISHED and attached to the "Climate and
// Biomes" browse category (currently empty). Quiz 31 is left untouched — delete
// or leave it unpublished once you're happy with the four.
//
// Idempotent: quizzes are matched by title, so re-running never duplicates.
//   pnpm --filter @workspace/scripts run split-biomes-quiz

import { asc, eq } from "drizzle-orm";
import {
  db,
  pool,
  quizzesTable,
  questionsTable,
  categoriesTable,
  quizCategoriesTable,
} from "@workspace/db";

const SOURCE_QUIZ_ID = 31;
const CATEGORY_SLUG = "climate-and-biomes";
const CATEGORY_TEXT = "Climate and Biomes";

type Spec = {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  // Source quiz-31 orderIndexes, in the order they should appear in the new quiz.
  sourceOrders: number[];
};

const SPECS: Spec[] = [
  {
    title: "Climate & Weather Basics",
    description:
      "The building blocks of climate: what a biome is, how weather differs from climate, and the key terms — precipitation, humidity, albedo, the rain shadow effect, and more.",
    difficulty: "easy",
    sourceOrders: [6, 28, 4, 3, 25, 12, 17, 19, 35, 39],
  },
  {
    title: "Climate Zones & What Shapes Them",
    description:
      "From tropical to polar: the world's major climate zones, and the forces that create them — latitude, altitude, ocean currents, and monsoon winds.",
    difficulty: "medium",
    sourceOrders: [1, 5, 22, 24, 13, 32, 8, 30, 15, 37],
  },
  {
    title: "Biomes of the World: Forests, Grasslands & Tundra",
    description:
      "Identify the world's great land biomes from their plants, climate, and telltale features — rainforest to tundra, savanna to taiga.",
    difficulty: "medium",
    sourceOrders: [9, 38, 29, 23, 16, 20, 36, 11, 0, 14],
  },
  {
    title: "Deserts, Grasslands & Extreme Environments",
    description:
      "The drylands and edge-case biomes: the Namib and Atacama deserts, steppe and savanna, mangrove coasts, permafrost tundra, and the high alpine.",
    difficulty: "medium",
    sourceOrders: [27, 18, 31, 7, 10, 26, 2, 21, 33, 34],
  },
];

// Deterministic 32-bit string hash (FNV-1a) → stable per-question seed.
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: small, well-distributed seeded PRNG. Deterministic given the seed.
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

// Shuffle a question's options with a seed derived from its text, returning the
// reordered options and the new index of the correct answer. Deterministic:
// the same question always yields the same permutation.
function shuffleOptions(
  text: string,
  options: string[],
  correctOption: number,
): { options: string[]; correctOption: number } {
  const rng = mulberry32(hashSeed(text));
  const idx = options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    options: idx.map((i) => options[i]),
    correctOption: idx.indexOf(correctOption),
  };
}

function validateSpecs(): void {
  const all = SPECS.flatMap((s) => s.sourceOrders);
  const expected = Array.from({ length: 40 }, (_, i) => i);
  const seen = new Set(all);
  const problems: string[] = [];

  for (const s of SPECS) {
    if (s.sourceOrders.length < 10 || s.sourceOrders.length > 12) {
      problems.push(`"${s.title}" has ${s.sourceOrders.length} questions (want 10-12)`);
    }
  }
  if (all.length !== 40) problems.push(`total source orders = ${all.length}, expected 40`);
  if (seen.size !== all.length) problems.push("a source question is used in more than one quiz");
  for (const i of expected) {
    if (!seen.has(i)) problems.push(`source order ${i} is not used by any quiz`);
  }
  if (problems.length) throw new Error("Split spec invalid:\n  - " + problems.join("\n  - "));
}

async function main(): Promise<void> {
  validateSpecs();

  const source = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, SOURCE_QUIZ_ID))
    .orderBy(asc(questionsTable.orderIndex));
  if (source.length !== 40) {
    throw new Error(
      `Source quiz ${SOURCE_QUIZ_ID} has ${source.length} questions, expected 40. ` +
        `Run dedupe-quiz-questions first.`,
    );
  }
  const byOrder = new Map(source.map((q) => [q.orderIndex, q]));

  const [category] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, CATEGORY_SLUG));
  if (!category) throw new Error(`Category "${CATEGORY_SLUG}" not found.`);

  let created = 0;
  let skipped = 0;

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

    const [quiz] = await db
      .insert(quizzesTable)
      .values({
        title: spec.title,
        description: spec.description,
        category: CATEGORY_TEXT,
        difficulty: spec.difficulty,
        published: false,
      })
      .returning({ id: quizzesTable.id });

    const rows = spec.sourceOrders.map((order, i) => {
      const src = byOrder.get(order);
      if (!src) throw new Error(`Source order ${order} missing from quiz ${SOURCE_QUIZ_ID}`);
      const shuffled = shuffleOptions(src.text, src.options, src.correctOption);
      // Sanity: the correct answer text must survive the shuffle unchanged.
      if (shuffled.options[shuffled.correctOption] !== src.options[src.correctOption]) {
        throw new Error(`Shuffle corrupted the answer for: ${src.text}`);
      }
      return {
        quizId: quiz.id,
        text: src.text,
        options: shuffled.options,
        correctOption: shuffled.correctOption,
        explanation: src.explanation,
        funFact: src.funFact,
        imageUrl: src.imageUrl,
        orderIndex: i,
      };
    });
    await db.insert(questionsTable).values(rows);
    await db.insert(quizCategoriesTable).values({ quizId: quiz.id, categoryId: category.id });

    console.log(
      `  create "${spec.title}" (id ${quiz.id}, ${spec.difficulty}, ${rows.length} questions, unpublished)`,
    );
    created++;
  }

  // Report the resulting answer-position spread across the shuffled 40.
  const spread = [0, 0, 0, 0];
  for (const spec of SPECS) {
    for (const order of spec.sourceOrders) {
      const src = byOrder.get(order)!;
      spread[shuffleOptions(src.text, src.options, src.correctOption).correctOption]++;
    }
  }
  console.log(`Answer-position spread after shuffle (A/B/C/D): ${spread.join(" / ")}`);

  console.log(
    `\nQuizzes: ${created} created, ${skipped} already present.` +
      (created > 0
        ? " New quizzes are UNPUBLISHED and attached to the Climate and Biomes category."
        : ""),
  );
}

main()
  .catch((err) => {
    console.error("split-biomes-quiz failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
