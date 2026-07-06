// Import public content from the live worldgeographytrivia.com API into the
// local Postgres so the local front page matches production. Preserves live
// row IDs. Questions get correct_option=0 + placeholder explanation because
// the public API (correctly) withholds answer data.
const { Pool } = require("pg");
const LIVE = "https://worldgeographytrivia.com/api";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const snake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

async function getJson(path) {
  const res = await fetch(`${LIVE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function columnsOf(client, table) {
  const r = await client.query(
    `select column_name from information_schema.columns where table_name=$1`,
    [table],
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function insertRows(client, table, rows) {
  if (!rows.length) return 0;
  const cols = await columnsOf(client, table);
  let n = 0;
  for (const row of rows) {
    const entries = Object.entries(row)
      .map(([k, v]) => [snake(k), v])
      .filter(([k, v]) => cols.has(k) && v !== undefined);
    const names = entries.map(([k]) => `"${k}"`).join(",");
    const ph = entries.map((_, i) => `$${i + 1}`).join(",");
    await client.query(
      `insert into ${table} (${names}) values (${ph})`,
      entries.map(([, v]) => v),
    );
    n++;
  }
  if (cols.has("id")) {
    await client.query(
      `select setval(pg_get_serial_sequence('${table}','id'), (select coalesce(max(id),1) from ${table}))`,
    );
  }
  return n;
}

function flattenTree(nodes, out = []) {
  for (const n of nodes) {
    out.push({
      id: n.id, name: n.name, slug: n.slug, parentId: n.parentId,
      imageUrl: n.imageUrl, published: n.published,
    });
    flattenTree(n.children ?? [], out); // parent-first: FK-safe
  }
  return out;
}

(async () => {
  const client = await pool.connect();
  try {
    const [tree, quizzes, courses, factoids, articles] = await Promise.all([
      getJson("/categories/tree"),
      getJson("/quizzes"),
      getJson("/courses"),
      getJson("/factoids"),
      getJson("/articles"),
    ]);

    await client.query("begin");
    await client.query(
      `truncate categories, quizzes, questions, quiz_categories,
       question_categories, quiz_attempts, courses, course_modules,
       factoids, articles restart identity cascade`,
    );

    const cats = flattenTree(tree);
    console.log("categories:", await insertRows(client, "categories", cats));

    console.log(
      "quizzes:",
      await insertRows(client, "quizzes", quizzes.map((q) => ({
        id: q.id, title: q.title, description: q.description,
        category: q.category, difficulty: q.difficulty, published: q.published,
      }))),
    );
    const quizCats = quizzes.flatMap((q) =>
      (q.categories ?? []).map((c) => ({ quizId: q.id, categoryId: c.id })),
    );
    console.log("quiz_categories:", await insertRows(client, "quiz_categories", quizCats));

    let nq = 0, nqc = 0;
    for (const q of quizzes) {
      const questions = await getJson(`/quizzes/${q.id}/questions`);
      nq += await insertRows(client, "questions", questions.map((x) => ({
        id: x.id, quizId: x.quizId, text: x.text, options: x.options,
        imageUrl: x.imageUrl, orderIndex: x.orderIndex,
        correctOption: 0,
        explanation: "(imported from the live site — answer data is not public)",
      })));
      nqc += await insertRows(client, "question_categories",
        questions.flatMap((x) =>
          (x.categories ?? []).map((c) => ({ questionId: x.id, categoryId: c.id }))),
      );
    }
    console.log("questions:", nq, "question_categories:", nqc);

    console.log(
      "courses:",
      await insertRows(client, "courses", courses.map((c, i) => ({
        id: c.id, title: c.title, slug: c.slug, description: c.description,
        imageUrl: c.imageUrl, orderIndex: i,
      }))),
    );
    let nm = 0;
    for (const c of courses) {
      const detail = await getJson(`/courses/${c.slug}`);
      nm += await insertRows(client, "course_modules", (detail.modules ?? []).map((m) => ({
        id: m.id, courseId: c.id, title: m.title, slug: m.slug,
        orderIndex: m.orderIndex,
      })));
    }
    console.log("course_modules:", nm);

    console.log(
      "factoids:",
      await insertRows(client, "factoids", factoids.map((f) => ({
        id: f.id, text: f.text, sourceLabel: f.sourceLabel,
        sourceUrl: f.sourceUrl, published: f.published,
      }))),
    );

    const fullArticles = [];
    for (const a of articles) {
      const detail = await getJson(`/articles/${a.slug}`).catch(() => a);
      fullArticles.push({
        id: a.id, title: a.title, slug: a.slug, summary: a.summary,
        imageUrl: a.imageUrl, body: detail.body ?? a.summary ?? a.title,
        published: a.published ?? true,
      });
    }
    console.log("articles:", await insertRows(client, "articles", fullArticles));

    await client.query("commit");
    console.log("done");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
})();
