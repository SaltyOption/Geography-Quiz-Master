/**
 * Post-build prerender script.
 *
 * After `vite build`, this script reads the built index.html and emits
 * route-specific copies in dist/public/ so that static file servers and
 * crawlers receive meaningful <head> metadata AND crawlable body content in
 * the initial HTML response — without waiting for JavaScript to execute.
 *
 * Dynamic route data (quizzes, categories, courses) is read directly from
 * the database so prerendering is deterministic and independent of whether
 * the API server is running during the build step.
 *
 * Configuration:
 *   DATABASE_URL           – PostgreSQL connection string (required for dynamic routes)
 *   PGHOST / PGPORT / …   – Alternative individual PG env vars (standard pg fallback)
 *   VITE_CANONICAL_DOMAIN  – Absolute base URL for production (e.g. https://myapp.com)
 *
 * Run: `node prerender.mjs`  (called automatically by the `build` npm script)
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist/public");

const SITE_NAME = "World Geography Trivia";
const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------

/** Minimal HTML-attribute and text escaping for injected values. */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Returns a copy of `template` (built index.html) with <head> tags
 * overwritten to match the provided route-specific metadata.
 */
function injectHead(template, { title, description, path }) {
  const fullTitle =
    title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const canonical = domain ? `${domain}${path}` : "";
  const ogImage = domain ? `${domain}/opengraph.jpg` : "";

  let html = template;

  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${esc(fullTitle)}</title>`,
  );
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${esc(description)}$2`,
  );

  if (canonical) {
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
      `$1${esc(canonical)}$2`,
    );
    html = html.replace(
      /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
      `$1${esc(canonical)}$2`,
    );
  }
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${esc(fullTitle)}$2`,
  );
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${esc(description)}$2`,
  );
  if (ogImage) {
    html = html.replace(
      /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
      `$1${esc(ogImage)}$2`,
    );
    html = html.replace(
      /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,
      `$1${esc(ogImage)}$2`,
    );
  }
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${esc(fullTitle)}$2`,
  );
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${esc(description)}$2`,
  );

  return html;
}

/**
 * Injects crawlable static body content into <div id="root">.
 * React replaces this on hydration, but non-JS crawlers see it in full.
 */
function injectBody(html, bodyHtml) {
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${bodyHtml}</div>`,
  );
}

/** Build a minimal shared nav that's consistent across prerendered pages. */
function sharedNav() {
  return `<header style="border-bottom:1px solid #e5e7eb;padding:0.75rem 1rem;background:#fff">
    <a href="/" style="font-weight:700;color:#0e7490;text-decoration:none">${esc(SITE_NAME)}</a>
  </header>`;
}

/** Write a prerendered file; creates parent directories as needed. */
function writeRoute(routePath, html) {
  const dir = join(distDir, routePath.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  console.log(`  ✓  ${routePath}`);
}

// ---------------------------------------------------------------------------
// Static route body generators
// ---------------------------------------------------------------------------

function homeBody() {
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Explore the World</h1>
  <p style="color:#6b7280;margin-bottom:1.5rem">Continents, capitals, cultures, and landmarks — one quick quiz at a time.</p>
  <nav aria-label="Site sections"><ul style="padding:0;list-style:none;display:flex;gap:1rem">
    <li><a href="/daily" style="color:#0e7490">Daily Quiz</a></li>
    <li><a href="/courses" style="color:#0e7490">Courses</a></li>
  </ul></nav>
</main>`;
}

function dailyBody() {
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Daily Quiz</h1>
  <p style="color:#6b7280">A new geography quiz every day. Test your knowledge of capitals, countries, landmarks, and regions.</p>
  <p style="margin-top:1rem"><a href="/daily" style="color:#0e7490;font-weight:600">Take today's quiz →</a></p>
</main>`;
}

function coursesBody(courses) {
  const items = courses
    .map(
      (c) =>
        `<li><a href="/courses/${esc(c.slug)}" style="color:#0e7490;font-weight:600">${esc(c.title)}</a>` +
        (c.description ? ` — <span style="color:#6b7280">${esc(c.description)}</span>` : "") +
        `</li>`,
    )
    .join("\n    ");
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Geography Courses</h1>
  <p style="color:#6b7280;margin-bottom:1.5rem">Learn geography through structured modules with explanations and fun facts.</p>
  ${items.length ? `<ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.5rem">\n    ${items}\n  </ul>` : ""}
</main>`;
}

function privacyBody() {
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Privacy Policy</h1>
  <p style="color:#6b7280">We never sell your data. We collect only what we need to run the site, and you can delete your account at any time.</p>
  <p style="margin-top:1rem"><a href="/" style="color:#0e7490">Back to home →</a></p>
</main>`;
}

function quizBody(quiz) {
  const cats =
    (quiz.categories ?? [])
      .map((c) => `<a href="/category/${esc(c.slug)}" style="color:#0e7490">${esc(c.name)}</a>`)
      .join(", ") || "";
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
    <a href="/" style="color:#0e7490">Home</a>${cats ? ` › ${cats}` : ""}
  </nav>
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(quiz.title)}</h1>
  ${quiz.description ? `<p style="color:#6b7280;margin-bottom:1rem">${esc(quiz.description)}</p>` : ""}
  <dl style="color:#6b7280;font-size:0.875rem;margin-bottom:1.5rem">
    <dt style="display:inline;font-weight:600">Difficulty:</dt>
    <dd style="display:inline;margin-left:0.25rem;text-transform:capitalize">${esc(quiz.difficulty)}</dd>
    <dt style="display:inline;margin-left:1rem;font-weight:600">Questions:</dt>
    <dd style="display:inline;margin-left:0.25rem">${esc(quiz.question_count)}</dd>
  </dl>
  <p><a href="/quiz/${esc(quiz.id)}" style="color:#fff;background:#0e7490;padding:0.5rem 1.25rem;border-radius:0.5rem;text-decoration:none;font-weight:600">Start Quiz →</a></p>
</main>`;
}

function categoryBody(category, quizzes) {
  const quizItems = quizzes
    .map(
      (q) =>
        `<li><a href="/quiz/${esc(q.id)}" style="color:#0e7490;font-weight:600">${esc(q.title)}</a>` +
        (q.difficulty
          ? ` <span style="color:#9ca3af;font-size:0.8rem">(${esc(q.difficulty)})</span>`
          : "") +
        `</li>`,
    )
    .join("\n      ");
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
    <a href="/" style="color:#0e7490">Home</a> › ${esc(category.name)}
  </nav>
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(category.name)}</h1>
  ${quizItems
    ? `<p style="color:#6b7280;margin-bottom:1rem">${esc(quizzes.length)} ${quizzes.length === 1 ? "quiz" : "quizzes"} in this category</p>
  <ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.5rem">
      ${quizItems}
    </ul>`
    : `<p style="color:#6b7280">No quizzes in this category yet.</p>`
  }
</main>`;
}

function courseDetailBody(course, modules) {
  const modItems = modules
    .map(
      (m, i) =>
        `<li style="padding:0.5rem 0;border-bottom:1px solid #f3f4f6">` +
        `<span style="color:#6b7280;font-size:0.8rem;margin-right:0.5rem">${i + 1}.</span>` +
        `<strong>${esc(m.title)}</strong>` +
        (m.description ? ` — <span style="color:#6b7280">${esc(m.description)}</span>` : "") +
        `</li>`,
    )
    .join("\n    ");
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
    <a href="/" style="color:#0e7490">Home</a> › <a href="/courses" style="color:#0e7490">Courses</a> › ${esc(course.title)}
  </nav>
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(course.title)}</h1>
  ${course.description ? `<p style="color:#6b7280;margin-bottom:1.5rem">${esc(course.description)}</p>` : ""}
  ${modItems
    ? `<h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.75rem">Modules</h2>
  <ul style="padding:0;list-style:none">
    ${modItems}
  </ul>`
    : ""
  }
</main>`;
}

// ---------------------------------------------------------------------------
// Database queries
// ---------------------------------------------------------------------------

async function loadData(pool) {
  const [quizzesRes, categoriesRes, coursesRes, quizCatRes, modulesRes] =
    await Promise.all([
      pool.query(
        `SELECT q.id, q.title, q.description, q.difficulty,
                COUNT(qu.id)::int AS question_count
         FROM quizzes q
         LEFT JOIN questions qu ON qu.quiz_id = q.id
         WHERE q.published = true
         GROUP BY q.id
         ORDER BY q.id`,
      ),
      pool.query(
        `WITH RECURSIVE tree AS (
           SELECT id, name, slug, parent_id, published
           FROM categories
           WHERE parent_id IS NULL AND published = true
           UNION ALL
           SELECT c.id, c.name, c.slug, c.parent_id, c.published
           FROM categories c
           INNER JOIN tree ON c.parent_id = tree.id
           WHERE c.published = true
         )
         SELECT id, name, slug, parent_id FROM tree ORDER BY name`,
      ),
      pool.query(
        `SELECT id, slug, title, description FROM courses ORDER BY order_index, id`,
      ),
      // Many-to-many: quiz → categories (for quiz pages)
      pool.query(
        `SELECT qc.quiz_id, c.id, c.name, c.slug
         FROM quiz_categories qc
         JOIN categories c ON c.id = qc.category_id
         WHERE c.published = true`,
      ),
      // Course modules (for course detail pages)
      pool.query(
        `SELECT id, course_id, slug, title, description, order_index
         FROM course_modules
         ORDER BY course_id, order_index`,
      ),
    ]);

  // Map quizId → categories
  const quizCategories = {};
  for (const row of quizCatRes.rows) {
    (quizCategories[row.quiz_id] ??= []).push({
      id: row.id,
      name: row.name,
      slug: row.slug,
    });
  }

  // Map courseId → modules
  const courseModules = {};
  for (const row of modulesRes.rows) {
    (courseModules[row.course_id] ??= []).push({
      title: row.title,
      description: row.description,
      slug: row.slug,
    });
  }

  // Build categoryId → [quizIds] map using quiz_categories
  const categoryQuizIds = {};
  for (const [quizId, cats] of Object.entries(quizCategories)) {
    for (const cat of cats) {
      (categoryQuizIds[cat.id] ??= []).push(Number(quizId));
    }
  }

  const quizMap = {};
  for (const q of quizzesRes.rows) {
    quizMap[q.id] = { ...q, categories: quizCategories[q.id] ?? [] };
  }

  return {
    quizzes: quizzesRes.rows,
    quizMap,
    categories: categoriesRes.rows,
    categoryQuizIds,
    courses: coursesRes.rows,
    courseModules,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const template = readFileSync(join(distDir, "index.html"), "utf-8");

// Connect to database for dynamic route data
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let data;
try {
  console.log("\nConnecting to database for dynamic route data…");
  data = await loadData(pool);
  console.log(
    `  Found: ${data.quizzes.length} quizzes, ${data.categories.length} categories, ${data.courses.length} courses`,
  );
} catch (err) {
  console.error(`\n✗ Database query failed: ${err.message}`);
  console.error("  Ensure DATABASE_URL is set and the database is reachable.");
  process.exit(1);
} finally {
  await pool.end();
}

// ---------------------------------------------------------------------------
// 1. Home (/ — already index.html, update with crawlable body only)
// ---------------------------------------------------------------------------
console.log("\nPrerendering static routes…");
{
  const meta = {
    title: SITE_NAME,
    description:
      "Play world geography quizzes and short courses covering capitals, countries, landmarks, and regions.",
    path: "/",
  };
  const html = injectBody(injectHead(template, meta), homeBody());
  writeFileSync(join(distDir, "index.html"), html, "utf-8");
  console.log("  ✓  / (home)");
}

// ---------------------------------------------------------------------------
// 2. Daily
// ---------------------------------------------------------------------------
{
  const meta = {
    title: "Daily Quiz",
    description:
      "Take today's daily geography quiz on World Geography Trivia. A new quiz every day — test your knowledge of capitals, countries, landmarks, and regions.",
    path: "/daily",
  };
  writeRoute("/daily", injectBody(injectHead(template, meta), dailyBody()));
}

// ---------------------------------------------------------------------------
// 3. Courses listing
// ---------------------------------------------------------------------------
{
  const meta = {
    title: "Geography Courses",
    description:
      "Learn world geography through structured courses. Master modules on capitals, regions, landmarks, and more — each course builds knowledge step by step.",
    path: "/courses",
  };
  writeRoute(
    "/courses",
    injectBody(injectHead(template, meta), coursesBody(data.courses)),
  );
}

// ---------------------------------------------------------------------------
// 4. Privacy
// ---------------------------------------------------------------------------
{
  const meta = {
    title: "Privacy Policy",
    description:
      "Read the World Geography Trivia privacy policy. We never sell your data, collect only what we need to run the site, and let you delete your account at any time.",
    path: "/privacy",
  };
  writeRoute("/privacy", injectBody(injectHead(template, meta), privacyBody()));
}

// ---------------------------------------------------------------------------
// 5. Quizzes (/quiz/:id)
// ---------------------------------------------------------------------------
console.log(`\nPrerendering ${data.quizzes.length} quiz pages…`);
for (const quiz of data.quizzes) {
  const fullQuiz = data.quizMap[quiz.id];
  const description =
    quiz.description ||
    `Test your knowledge with the "${quiz.title}" geography quiz. ${quiz.question_count} multiple-choice questions.`;
  const meta = {
    title: quiz.title,
    description,
    path: `/quiz/${quiz.id}`,
  };
  writeRoute(`/quiz/${quiz.id}`, injectBody(injectHead(template, meta), quizBody(fullQuiz)));
}

// ---------------------------------------------------------------------------
// 6. Categories (/category/:slug)
// ---------------------------------------------------------------------------
console.log(`\nPrerendering ${data.categories.length} category pages…`);
for (const cat of data.categories) {
  const quizIds = data.categoryQuizIds[cat.id] ?? [];
  const quizzes = quizIds.map((id) => data.quizMap[id]).filter(Boolean);
  const description =
    quizzes.length > 0
      ? `Explore ${quizzes.length} ${quizzes.length === 1 ? "quiz" : "quizzes"} in the ${cat.name} category on World Geography Trivia.`
      : `Browse the ${cat.name} category on World Geography Trivia.`;
  const meta = {
    title: cat.name,
    description,
    path: `/category/${cat.slug}`,
  };
  writeRoute(
    `/category/${cat.slug}`,
    injectBody(injectHead(template, meta), categoryBody(cat, quizzes)),
  );
}

// ---------------------------------------------------------------------------
// 7. Course detail pages (/courses/:slug)
// ---------------------------------------------------------------------------
console.log(`\nPrerendering ${data.courses.length} course pages…`);
for (const course of data.courses) {
  const modules = data.courseModules[course.id] ?? [];
  const description =
    course.description ||
    `Study ${course.title} on World Geography Trivia. Work through structured modules with explanations and fun facts to master geography step by step.`;
  const meta = {
    title: course.title,
    description,
    path: `/courses/${course.slug}`,
  };
  writeRoute(
    `/courses/${course.slug}`,
    injectBody(
      injectHead(template, meta),
      courseDetailBody(course, modules),
    ),
  );
}

console.log("\n✓ Prerender complete.");
