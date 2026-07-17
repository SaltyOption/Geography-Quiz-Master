// De-duplicate the questions of a quiz that was seeded with repeated rows.
//
// The "Climate and Biomes" quiz (id 31) was imported with every question
// stored three times: 120 rows, 40 distinct questions. The copies are
// byte-identical across text, options, correct option, explanation, fun fact,
// and image — so keeping one of each loses nothing.
//
// This script keeps, for each fully-identical group, the row with the lowest
// orderIndex and deletes the rest, then re-sequences the survivors' orderIndex
// to a dense 0..N-1. Two rows are treated as duplicates ONLY when every content
// field matches (a normalized-text-plus-options-plus-answer-plus-prose
// signature), so it can never collapse two genuinely different questions.
//
// Safe and idempotent:
//   - runs in a single transaction (all-or-nothing)
//   - re-running after a clean-up deletes nothing and leaves ordering stable
//   - aborts if the survivor count wouldn't match the distinct-question count
//
// Preview without writing:
//   DEDUPE_DRY_RUN=1 pnpm --filter @workspace/scripts run dedupe-quiz-questions [quizId]
// Apply (defaults to quiz 31):
//   pnpm --filter @workspace/scripts run dedupe-quiz-questions [quizId]

import { and, asc, eq, inArray } from "drizzle-orm";
import { db, pool, questionsTable, quizzesTable } from "@workspace/db";

const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DEDUPE_DRY_RUN ?? "");
const QUIZ_ID = Number.parseInt(process.argv[2] ?? "31", 10);

if (!Number.isInteger(QUIZ_ID) || QUIZ_ID <= 0) {
  console.error(`Invalid quiz id: ${process.argv[2]}`);
  process.exit(1);
}

// A content signature: two rows are duplicates only if ALL of these match.
// Text is normalized (lowercase, collapsed whitespace, trailing "?" stripped)
// so trivial punctuation differences still collapse; everything else is exact.
function signature(q: {
  text: string;
  options: string[];
  correctOption: number;
  explanation: string;
  funFact: string | null;
  imageUrl: string | null;
}): string {
  const normText = q.text.trim().toLowerCase().replace(/\s+/g, " ").replace(/\?+$/, "");
  return JSON.stringify([
    normText,
    q.options,
    q.correctOption,
    (q.explanation ?? "").trim(),
    (q.funFact ?? "").trim(),
    (q.imageUrl ?? "").trim(),
  ]);
}

async function main(): Promise<void> {
  const [quiz] = await db
    .select({ id: quizzesTable.id, title: quizzesTable.title, published: quizzesTable.published })
    .from(quizzesTable)
    .where(eq(quizzesTable.id, QUIZ_ID));
  if (!quiz) {
    console.error(`Quiz ${QUIZ_ID} not found.`);
    process.exit(1);
  }

  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, QUIZ_ID))
    .orderBy(asc(questionsTable.orderIndex), asc(questionsTable.id));

  // Group by content signature, preserving first-seen (lowest orderIndex) order.
  const keepBySig = new Map<string, number>(); // signature -> id to keep
  const deleteIds: number[] = [];
  for (const r of rows) {
    const sig = signature(r);
    if (keepBySig.has(sig)) {
      deleteIds.push(r.id);
    } else {
      keepBySig.set(sig, r.id);
    }
  }

  const distinct = keepBySig.size;
  console.log(
    `Quiz ${QUIZ_ID} "${quiz.title}" (${quiz.published ? "published" : "unpublished"}): ` +
      `${rows.length} rows, ${distinct} distinct questions, ${deleteIds.length} duplicate rows to remove.`,
  );

  if (deleteIds.length === 0) {
    console.log("Nothing to do — already de-duplicated.");
    return;
  }

  // Sanity: survivors must equal the distinct-question count.
  if (rows.length - deleteIds.length !== distinct) {
    throw new Error(
      `Refusing to run: survivor math is off ` +
        `(${rows.length} - ${deleteIds.length} != ${distinct}).`,
    );
  }

  if (DRY_RUN) {
    console.log(`DRY RUN — would delete ${deleteIds.length} rows and re-sequence ${distinct} survivors to 0..${distinct - 1}. No changes made.`);
    return;
  }

  await db.transaction(async (tx) => {
    // Delete in batches to keep the IN list sane.
    for (let i = 0; i < deleteIds.length; i += 500) {
      const batch = deleteIds.slice(i, i + 500);
      await tx
        .delete(questionsTable)
        .where(and(eq(questionsTable.quizId, QUIZ_ID), inArray(questionsTable.id, batch)));
    }

    // Re-sequence survivors to a dense 0..N-1 by their existing order.
    const survivors = await tx
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(eq(questionsTable.quizId, QUIZ_ID))
      .orderBy(asc(questionsTable.orderIndex), asc(questionsTable.id));

    if (survivors.length !== distinct) {
      throw new Error(
        `Post-delete survivor count ${survivors.length} != expected ${distinct}; rolling back.`,
      );
    }

    for (let i = 0; i < survivors.length; i++) {
      await tx
        .update(questionsTable)
        .set({ orderIndex: i })
        .where(eq(questionsTable.id, survivors[i].id));
    }
  });

  const after = await db
    .select({ id: questionsTable.id })
    .from(questionsTable)
    .where(eq(questionsTable.quizId, QUIZ_ID));
  console.log(`Done. Quiz ${QUIZ_ID} now has ${after.length} questions, order 0..${after.length - 1}.`);
}

main()
  .catch((err) => {
    console.error("dedupe-quiz-questions failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
