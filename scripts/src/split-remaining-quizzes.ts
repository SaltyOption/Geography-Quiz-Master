// Split the last two oversized quizzes — "Population and Cities" (id 32) and
// "Regional Geography" (id 33) — into four themed quizzes each, mirroring the
// earlier biomes/capitals/map-skills splits.
//
// Question content is copied verbatim from each source, so the splits cannot
// introduce errors; a set check confirms the four quizzes reconstruct each
// source (minus any explicitly dropped duplicate). Regional Geography drops one
// redundant question: orders 15 and 37 both ask for the Levant via "eastern
// Mediterranean"; order 37 (which lists the countries) is kept, 15 dropped.
//
// Each quiz gets a balanced answer spread (even, deterministically-scrambled
// target positions) and is attached to its browse category. New quizzes are
// UNPUBLISHED; the source quizzes are left intact — delete them once you're
// happy. Idempotent (matched by title).
//   pnpm --filter @workspace/scripts run split-remaining-quizzes

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

type Spec = {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  sourceOrders: number[];
};
type Job = {
  sourceQuizId: number;
  categorySlug: string;
  categoryText: string;
  dropOrders: number[];
  specs: Spec[];
};

const JOBS: Job[] = [
  {
    sourceQuizId: 32,
    categorySlug: "population-and-cities",
    categoryText: "Population and Cities",
    dropOrders: [],
    specs: [
      {
        title: "Migration, Movement & Urban Growth",
        description:
          "How and why people move: migration, push and pull factors, commuting, urbanization, sprawl, and the rise of the megacity.",
        difficulty: "medium",
        sourceOrders: [1, 2, 3, 6, 7, 10, 12, 21, 22, 30, 38],
      },
      {
        title: "Population & City Life: Key Terms",
        description:
          "The vocabulary of people and places: census and life expectancy, density and population pyramids, primate cities, world cities, gentrification, and more.",
        difficulty: "medium",
        sourceOrders: [0, 4, 5, 11, 13, 17, 18, 20, 26, 34, 36],
      },
      {
        title: "Great Cities of the World, Part 1",
        description: "Name the city, from Paris and Tokyo to Karachi and Brasília.",
        difficulty: "easy",
        sourceOrders: [8, 9, 14, 15, 16, 19, 23, 24, 37],
      },
      {
        title: "Great Cities of the World, Part 2",
        description: "More cities to place, from Shanghai and Mumbai to São Paulo and San Jose.",
        difficulty: "medium",
        sourceOrders: [25, 27, 28, 29, 31, 32, 33, 35, 39],
      },
    ],
  },
  {
    sourceQuizId: 33,
    categorySlug: "regional-geography",
    categoryText: "Regional Geography",
    dropOrders: [15],
    specs: [
      {
        title: "Regions of Europe",
        description:
          "Scandinavia to the Balkans, the Iberian Peninsula to Tuscany — the regions that make up Europe.",
        difficulty: "medium",
        sourceOrders: [10, 11, 12, 13, 21, 22, 26, 27, 28, 33, 39],
      },
      {
        title: "Regions of the Americas",
        description:
          "New England to Patagonia, the Prairies to the Amazon — the regions of North and South America.",
        difficulty: "medium",
        sourceOrders: [5, 6, 7, 8, 9, 29, 30, 31, 35, 36],
      },
      {
        title: "Regions of Africa & the Middle East",
        description:
          "The Maghreb and the Sahel, the Levant and the Arabian Peninsula, and the regions of sub-Saharan Africa.",
        difficulty: "medium",
        sourceOrders: [16, 17, 18, 20, 23, 24, 32, 37, 25],
      },
      {
        title: "Regions of Asia & the Pacific",
        description:
          "Central Asia and Siberia to the island realms of Melanesia, Micronesia, and Polynesia.",
        difficulty: "hard",
        sourceOrders: [0, 1, 14, 38, 2, 3, 4, 19, 34],
      },
    ],
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

function validateJob(job: Job, sourceOrders: number[]): void {
  const used = job.specs.flatMap((s) => s.sourceOrders);
  const problems: string[] = [];
  for (const s of job.specs) {
    if (s.sourceOrders.length < 9 || s.sourceOrders.length > 12) {
      problems.push(`"${s.title}" has ${s.sourceOrders.length} questions (want ~10)`);
    }
  }
  if (new Set(used).size !== used.length) problems.push(`quiz ${job.sourceQuizId}: a source order is reused`);
  const covered = new Set([...used, ...job.dropOrders]);
  for (const o of sourceOrders) if (!covered.has(o)) problems.push(`quiz ${job.sourceQuizId}: order ${o} neither used nor dropped`);
  for (const o of used) if (!sourceOrders.includes(o)) problems.push(`quiz ${job.sourceQuizId}: used order ${o} does not exist`);
  if (problems.length) throw new Error("Split spec invalid:\n  - " + problems.join("\n  - "));
}

async function runJob(job: Job): Promise<{ created: number; skipped: number }> {
  const source = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, job.sourceQuizId))
    .orderBy(asc(questionsTable.orderIndex));
  validateJob(job, source.map((q) => q.orderIndex));
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
    .where(eq(categoriesTable.slug, job.categorySlug));
  if (!category) throw new Error(`Category "${job.categorySlug}" not found.`);

  let created = 0;
  let skipped = 0;

  for (const spec of job.specs) {
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
          category: job.categoryText,
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
  return { created, skipped };
}

async function main(): Promise<void> {
  let created = 0;
  let skipped = 0;
  for (const job of JOBS) {
    console.log(`\nSource quiz ${job.sourceQuizId} -> ${job.categoryText}:`);
    const r = await runJob(job);
    created += r.created;
    skipped += r.skipped;
  }
  console.log(
    `\nTotal: ${created} created, ${skipped} already present. New quizzes are UNPUBLISHED.`,
  );
}

main()
  .catch((err) => {
    console.error("split-remaining-quizzes failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
