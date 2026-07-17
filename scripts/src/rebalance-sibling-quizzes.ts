// Repair the four sibling 120-question quizzes that were imported like the old
// "Climate and Biomes" quiz: every question stored ~3x, with correct answers
// clustered at option A.
//
// Per quiz this script:
//   1. De-duplicates — keeps one row per fully-identical group (they are
//      byte-identical copies), collapsing 120 rows to the distinct set.
//   2. Applies content fixes — e.g. Regional Geography's "Which region includes
//      the island of Bali?" had the answer "Indonesia" (a country); corrected
//      to a real region.
//   3. Rebalances answers (shuffle: true only) — options are shuffled with a
//      deterministic, canonicalized, text-seeded permutation so the correct
//      answer is spread across A-D instead of sitting at A. World Capitals II
//      already has a healthy spread, so it is de-duplicated only.
//   4. Preserves question category tags across the rebuild.
//
// Runs one transaction per quiz. Only quizzes that still contain duplicate rows
// are processed, so a second run is a no-op (idempotent). Preview without
// writing:  SIBLING_DRY_RUN=1 pnpm --filter @workspace/scripts run rebalance-sibling-quizzes

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  quizzesTable,
  questionsTable,
  questionCategoriesTable,
} from "@workspace/db";

const DRY_RUN = /^(1|true|yes)$/i.test(process.env.SIBLING_DRY_RUN ?? "");

type Fix = { matchText: string; newCorrectAnswerText: string };
type QuizSpec = { id: number; title: string; shuffle: boolean; fixes: Fix[] };

const QUIZZES: QuizSpec[] = [
  { id: 29, title: "World Capitals II", shuffle: false, fixes: [] },
  { id: 30, title: "Map Skills and Coordinates", shuffle: true, fixes: [] },
  { id: 32, title: "Population and Cities", shuffle: true, fixes: [] },
  {
    id: 33,
    title: "Regional Geography",
    shuffle: true,
    fixes: [
      {
        // "Indonesia" is a country, not a region; the other options are regions.
        matchText: "which region includes the island of bali",
        newCorrectAnswerText: "Southeast Asia",
      },
    ],
  },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/\?+$/, "");

// FNV-1a hash → stable per-question seed.
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

// Idempotent shuffle: canonicalize (sort options by text) BEFORE the seeded
// permutation, so the result depends only on the question text and its option
// set — not the current stored order. Running twice yields the same layout.
function idempotentShuffle(
  text: string,
  options: string[],
  correctOption: number,
): { options: string[]; correctOption: number } {
  const correctText = options[correctOption];
  const canonical = [...options].sort((a, b) => a.localeCompare(b));
  const rng = mulberry32(hashSeed(norm(text)));
  const order = canonical.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const shuffled = order.map((i) => canonical[i]);
  return { options: shuffled, correctOption: shuffled.indexOf(correctText) };
}

async function processQuiz(spec: QuizSpec): Promise<void> {
  const [quiz] = await db
    .select({ id: quizzesTable.id, title: quizzesTable.title })
    .from(quizzesTable)
    .where(eq(quizzesTable.id, spec.id));
  if (!quiz) {
    console.log(`  skip   quiz ${spec.id} — not found`);
    return;
  }
  if (quiz.title !== spec.title) {
    throw new Error(`Quiz ${spec.id} is "${quiz.title}", expected "${spec.title}" — aborting.`);
  }

  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, spec.id))
    .orderBy(asc(questionsTable.orderIndex), asc(questionsTable.id));

  // Dedupe by question identity: same text + same options + same correct
  // answer. Explanation and fun-fact wording are intentionally excluded — a
  // couple of copies differ only in fun-fact phrasing (e.g. the Scandinavia
  // question), and those are the same question, so they collapse to one. The
  // lowest-orderIndex copy (and its fun fact) is the one kept.
  const sig = (r: (typeof rows)[number]) =>
    JSON.stringify([norm(r.text), r.options, r.correctOption]);
  const reps = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!reps.has(sig(r))) reps.set(sig(r), r);
  const representatives = [...reps.values()];

  if (rows.length === representatives.length) {
    console.log(`  skip   "${quiz.title}" — already de-duplicated (${rows.length} questions)`);
    return;
  }

  // Snapshot category tags by normalized text, so they survive the rebuild.
  const tagRows = await db
    .select({ text: questionsTable.text, categoryId: questionCategoriesTable.categoryId })
    .from(questionCategoriesTable)
    .innerJoin(questionsTable, eq(questionsTable.id, questionCategoriesTable.questionId))
    .where(eq(questionsTable.quizId, spec.id));
  const tagsByText = new Map<string, Set<number>>();
  for (const t of tagRows) {
    const key = norm(t.text);
    (tagsByText.get(key) ?? tagsByText.set(key, new Set()).get(key)!).add(t.categoryId);
  }

  // Build the final question set: apply content fixes, then optional shuffle.
  let fixesApplied = 0;
  const spread = [0, 0, 0, 0];
  const finalRows = representatives.map((r, i) => {
    let options = [...r.options];
    let correctOption = r.correctOption;

    for (const fix of spec.fixes) {
      if (norm(r.text) === fix.matchText) {
        options = options.map((o, idx) => (idx === correctOption ? fix.newCorrectAnswerText : o));
        fixesApplied++;
      }
    }
    if (spec.shuffle) {
      const s = idempotentShuffle(r.text, options, correctOption);
      options = s.options;
      correctOption = s.correctOption;
    }
    spread[correctOption]++;
    return {
      quizId: spec.id,
      text: r.text,
      options,
      correctOption,
      explanation: r.explanation,
      funFact: r.funFact,
      imageUrl: r.imageUrl,
      orderIndex: i,
    };
  });

  const expectedFixes = spec.fixes.length;
  if (fixesApplied !== expectedFixes) {
    throw new Error(
      `"${quiz.title}": applied ${fixesApplied} content fixes, expected ${expectedFixes} — aborting.`,
    );
  }

  console.log(
    `  ${DRY_RUN ? "DRY " : ""}"${quiz.title}": ${rows.length} rows -> ${finalRows.length} questions, ` +
      `${spec.fixes.length} fix(es), ${spec.shuffle ? `shuffle spread A/B/C/D ${spread.join("/")}` : "no shuffle"}, ` +
      `${tagsByText.size} tagged question(s) preserved.`,
  );
  if (DRY_RUN) return;

  await db.transaction(async (tx) => {
    // Rebuild the quiz's questions from the final set. Deleting cascades the
    // old category tags; they are re-attached below from the text snapshot.
    await tx.delete(questionsTable).where(eq(questionsTable.quizId, spec.id));
    const inserted = await tx
      .insert(questionsTable)
      .values(finalRows)
      .returning({ id: questionsTable.id, text: questionsTable.text });

    const links: { questionId: number; categoryId: number }[] = [];
    for (const row of inserted) {
      for (const catId of tagsByText.get(norm(row.text)) ?? []) {
        links.push({ questionId: row.id, categoryId: catId });
      }
    }
    if (links.length) await tx.insert(questionCategoriesTable).values(links);

    // Sanity: tag count must be preserved.
    const preserved = links.length;
    const expectedTags = tagRows.length ? [...tagsByText.values()].reduce((n, s) => n + s.size, 0) : 0;
    if (preserved !== expectedTags) {
      throw new Error(`Tag count changed (${preserved} != ${expectedTags}); rolling back.`);
    }
  });
}

async function main(): Promise<void> {
  for (const spec of QUIZZES) await processQuiz(spec);
  console.log(
    DRY_RUN ? "\nDRY RUN — no changes written." : "\nDone. Quizzes remain UNPUBLISHED for review.",
  );
}

main()
  .catch((err) => {
    console.error("rebalance-sibling-quizzes failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
