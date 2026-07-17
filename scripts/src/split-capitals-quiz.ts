// Split the de-duplicated "World Capitals II" quiz (id 29, 42 questions) into
// four engagement-sized quizzes grouped by region, mirroring the biomes split.
//
// Question content is copied verbatim from the source (already de-duplicated),
// so the split cannot introduce errors. One source question is intentionally
// DROPPED: orders 4 and 40 are the same question ("administrative capital of
// South Africa, executive branch" -> Pretoria) with only "What is..." vs
// "Which city is..." wording; order 4 is kept, order 40 dropped.
//
// Each copied question's options are shuffled with a deterministic,
// canonicalized, text-seeded permutation so every new quiz has a balanced
// answer spread (the source leaned toward B/C). Per-question category tags are
// carried over, and each quiz is attached to the "Capitals" browse category.
//
// New quizzes are created UNPUBLISHED. The source quiz is left intact — delete
// it once you're happy with the four. Idempotent: matched by title.
//   pnpm --filter @workspace/scripts run split-capitals-quiz

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  quizzesTable,
  questionsTable,
  categoriesTable,
  quizCategoriesTable,
  questionCategoriesTable,
} from "@workspace/db";

const SOURCE_QUIZ_ID = 29;
const CATEGORY_SLUG = "capitals";
const CATEGORY_TEXT = "Capitals";
const DROP_ORDERS = [40]; // redundant duplicate of order 4

type Spec = {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  sourceOrders: number[];
};

const SPECS: Spec[] = [
  {
    title: "Capitals of Western & Southern Europe",
    description:
      "Paris, Rome, Madrid, Berlin and more — the capitals of western and southern Europe.",
    difficulty: "easy",
    sourceOrders: [8, 7, 6, 5, 9, 10, 11, 0, 26, 28],
  },
  {
    title: "Capitals of Northern & Eastern Europe",
    description:
      "From the Nordic capitals to Warsaw, Prague, Budapest and Kyiv — northern and eastern Europe.",
    difficulty: "easy",
    sourceOrders: [1, 2, 24, 34, 30, 39, 36, 12, 13],
  },
  {
    title: "Capitals of Asia & the Pacific",
    description:
      "Jakarta to Seoul, the Gulf states to Wellington — the capitals of Asia, the Middle East, and the Pacific.",
    difficulty: "medium",
    sourceOrders: [14, 15, 16, 17, 18, 19, 22, 25, 27, 37, 20],
  },
  {
    title: "Capitals of Africa & the Americas",
    description:
      "Cairo to Cape Town, Mexico City to Buenos Aires — the capitals of Africa and the Americas.",
    difficulty: "medium",
    sourceOrders: [33, 23, 31, 38, 4, 41, 3, 21, 29, 32, 35],
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
// Balanced per-quiz answer placement. A per-question hash shuffle distributes
// evenly across a large bank but clusters within a 10-question quiz, so instead
// we hand each quiz an even set of target positions (e.g. 3/3/2/2 for ten
// questions), scramble that sequence deterministically so it isn't a visible
// A,B,C,D cycle, and place each question's correct answer at its target.
function balancedTargets(seedText: string, n: number): number[] {
  const targets = Array.from({ length: n }, (_, i) => i % 4); // even counts
  const rng = mulberry32(hashSeed(seedText));
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  return targets;
}

// Place the correct answer at targetPos; distractors keep their relative order.
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
  const covered = new Set([...used, ...DROP_ORDERS]);
  for (const o of sourceOrders) if (!covered.has(o)) problems.push(`source order ${o} is neither used nor dropped`);
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

  // Per-question category tags, keyed by source question id.
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
        return {
          quizId: quiz.id,
          text: src.text,
          options: s.options,
          correctOption: s.correctOption,
          explanation: src.explanation,
          funFact: src.funFact,
          imageUrl: src.imageUrl,
          orderIndex: i,
          srcId: src.id,
        };
      });
      const inserted = await tx
        .insert(questionsTable)
        .values(rows.map(({ srcId, ...r }) => r))
        .returning({ id: questionsTable.id });

      // Carry over per-question category tags.
      const tagLinks: { questionId: number; categoryId: number }[] = [];
      rows.forEach((r, i) => {
        for (const catId of tagsByQid.get(r.srcId) ?? []) {
          tagLinks.push({ questionId: inserted[i].id, categoryId: catId });
        }
      });
      if (tagLinks.length) await tx.insert(questionCategoriesTable).values(tagLinks);

      await tx.insert(quizCategoriesTable).values({ quizId: quiz.id, categoryId: category.id });
    });

    console.log(
      `  create "${spec.title}" (${spec.difficulty}, ${spec.sourceOrders.length} questions, ` +
        `spread A/B/C/D ${spread.join("/")}, unpublished)`,
    );
    created++;
  }

  console.log(
    `\nQuizzes: ${created} created, ${skipped} already present.` +
      (created > 0
        ? ` Dropped ${DROP_ORDERS.length} redundant question. New quizzes are UNPUBLISHED, in the Capitals category.`
        : ""),
  );
}

main()
  .catch((err) => {
    console.error("split-capitals-quiz failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
