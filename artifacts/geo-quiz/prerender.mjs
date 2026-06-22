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
import { getMetaDescription } from "@workspace/seo-content";

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
function injectHead(template, { title, description: rawDescription, path }) {
  const fullTitle =
    title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const description = getMetaDescription(path) ?? rawDescription;
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

/**
 * Injects a JSON-LD <script> block into <head> before </head>.
 * Uses the same element ID as the client-side useJsonLd hook so React
 * finds and updates the existing tag on hydration instead of duplicating it.
 */
function injectJsonLd(html, ldData) {
  const scriptTag = `<script id="json-ld-structured-data" type="application/ld+json">${JSON.stringify(ldData)}</script>`;
  return html.replace("</head>", `${scriptTag}\n</head>`);
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

function homeBody(categories, courses) {
  // Build a tree from the flat categories list for grouped rendering
  const catMap = {};
  for (const c of categories) catMap[c.id] = { ...c, children: [] };
  const roots = [];
  for (const c of categories) {
    if (c.parent_id && catMap[c.parent_id]) {
      catMap[c.parent_id].children.push(catMap[c.id]);
    } else if (!c.parent_id) {
      roots.push(catMap[c.id]);
    }
  }

  // Render each root category with its children as a section
  const categorySections = roots
    .map((root) => {
      const childLinks = root.children.length
        ? root.children
            .map(
              (child) =>
                `<li><a href="/category/${esc(child.slug)}" style="color:#0e7490">${esc(child.name)}</a></li>`,
            )
            .join("\n        ")
        : "";
      return (
        `<section style="margin-bottom:1.5rem">` +
        `<h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">` +
        `<a href="/category/${esc(root.slug)}" style="color:#1f2937;text-decoration:none">${esc(root.name)}</a>` +
        `</h2>` +
        (childLinks
          ? `<ul style="padding:0 0 0 1rem;list-style:none;display:flex;flex-direction:column;gap:0.25rem">${childLinks}</ul>`
          : "") +
        `</section>`
      );
    })
    .join("\n  ");

  const courseItems = courses
    .map(
      (c) =>
        `<li><a href="/courses/${esc(c.slug)}" style="color:#0e7490">${esc(c.title)}</a></li>`,
    )
    .join("\n      ");

  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Explore the World</h1>
  <p style="color:#6b7280;margin-bottom:1.5rem">Continents, capitals, cultures, and landmarks — one quick quiz at a time.</p>
  <nav aria-label="Quick links" style="margin-bottom:1.5rem">
    <ul style="padding:0;list-style:none;display:flex;gap:1rem">
      <li><a href="/daily" style="color:#0e7490">Daily Quiz</a></li>
      <li><a href="/courses" style="color:#0e7490">Courses</a></li>
    </ul>
  </nav>
  ${categorySections ? `<section aria-label="Browse by category" style="margin-bottom:2rem">${categorySections}</section>` : ""}
  ${courseItems ? `<section aria-label="Learning courses" style="margin-bottom:2rem">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem"><a href="/courses" style="color:#1f2937;text-decoration:none">Learning Courses</a></h2>
    <ul style="padding:0 0 0 1rem;list-style:none;display:flex;flex-direction:column;gap:0.25rem">
      ${courseItems}
    </ul>
  </section>` : ""}
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

function aboutBody() {
  const paras = [
    "World Geography Trivia helps curious learners explore the world one quiz at a time.",
    "Whether you are brushing up on capitals, testing your knowledge of flags, learning where countries are located, or discovering famous landmarks, this site is designed to make geography feel fun, approachable, and memorable.",
    "The goal is simple: help you build real geographic knowledge without making it feel like homework. Each quiz is meant to teach as well as test, with questions that encourage you to notice patterns, make connections, and learn something new about the world.",
    "World Geography Trivia is for travelers, lifelong learners, trivia fans, students, teachers, and anyone who has ever looked at a map and thought, “I should probably know more about that place.”",
    "So pick a quiz, follow your curiosity, and see where in the world it takes you.",
  ]
    .map((p) => `<p style="color:#6b7280;margin-bottom:1rem">${esc(p)}</p>`)
    .join("\n  ");
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:1rem">About World Geography Trivia</h1>
  ${paras}
  <p style="margin-top:1rem"><a href="/" style="color:#0e7490">Browse quizzes →</a></p>
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

// Preserve the pristine, empty-root SPA shell (the just-built index.html, before
// any body injection below) as spa-template.html. The api-server ships this file
// inside its own bundle and uses it as the SSR template — it injects
// route-specific bodies into the EMPTY `<div id="root"></div>`, which only works
// if the shell has NOT yet had the home body baked in. It also carries the exact
// hashed asset references the static layer serves, so styles/scripts resolve.
writeFileSync(join(distDir, "spa-template.html"), template, "utf-8");
console.log("  ✓  spa-template.html (SSR shell for the API server)");

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
  const html = injectBody(injectHead(template, meta), homeBody(data.categories, data.courses));
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
  const itemListLd =
    data.courses.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Geography Courses",
          description:
            "Learn world geography through structured courses covering capitals, regions, landmarks, and more.",
          url: domain ? `${domain}/courses` : "/courses",
          numberOfItems: data.courses.length,
          itemListElement: data.courses.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: domain ? `${domain}/courses/${c.slug}` : `/courses/${c.slug}`,
            name: c.title,
          })),
        }
      : null;
  let coursesHtml = injectBody(injectHead(template, meta), coursesBody(data.courses));
  if (itemListLd) coursesHtml = injectJsonLd(coursesHtml, itemListLd);
  writeRoute("/courses", coursesHtml);
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
// 4b. About
// ---------------------------------------------------------------------------
{
  const meta = {
    title: "About",
    description:
      "World Geography Trivia makes geography fun with quizzes on capitals, flags, countries, and landmarks — for travelers, students, teachers, and lifelong learners.",
    path: "/about",
  };
  writeRoute("/about", injectBody(injectHead(template, meta), aboutBody()));
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

  const primaryCategory = (fullQuiz.categories ?? [])[0];
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: domain ? `${domain}/` : "/" },
  ];
  if (primaryCategory) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: primaryCategory.name,
      item: domain ? `${domain}/category/${primaryCategory.slug}` : `/category/${primaryCategory.slug}`,
    });
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: quiz.title,
      item: domain ? `${domain}/quiz/${quiz.id}` : `/quiz/${quiz.id}`,
    });
  } else {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: quiz.title,
      item: domain ? `${domain}/quiz/${quiz.id}` : `/quiz/${quiz.id}`,
    });
  }

  const quizBreadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  let quizHtml = injectBody(injectHead(template, meta), quizBody(fullQuiz));
  quizHtml = injectJsonLd(quizHtml, quizBreadcrumbLd);
  writeRoute(`/quiz/${quiz.id}`, quizHtml);
}

// ---------------------------------------------------------------------------
// 6. Categories (/category/:slug)
// ---------------------------------------------------------------------------
console.log(`\nPrerendering ${data.categories.length} category pages…`);

// Build a map for ancestor chain lookup (used for BreadcrumbList JSON-LD)
const catById = {};
for (const cat of data.categories) catById[cat.id] = cat;

function getCategoryAncestors(cat) {
  const chain = [];
  let current = catById[cat.parent_id];
  while (current) {
    chain.unshift(current);
    current = catById[current.parent_id];
  }
  return chain;
}

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

  const ancestors = getCategoryAncestors(cat);
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "All Quizzes",
        item: domain ? `${domain}/` : "/",
      },
      ...ancestors.map((a, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: a.name,
        item: domain ? `${domain}/category/${a.slug}` : `/category/${a.slug}`,
      })),
      {
        "@type": "ListItem",
        position: ancestors.length + 2,
        name: cat.name,
        item: domain ? `${domain}/category/${cat.slug}` : `/category/${cat.slug}`,
      },
    ],
  };

  let catHtml = injectBody(injectHead(template, meta), categoryBody(cat, quizzes));
  catHtml = injectJsonLd(catHtml, breadcrumbLd);
  writeRoute(`/category/${cat.slug}`, catHtml);
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

  const courseUrl = domain ? `${domain}/courses/${course.slug}` : `/courses/${course.slug}`;
  const courseLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course",
        name: course.title,
        description,
        url: courseUrl,
        provider: {
          "@type": "Organization",
          name: SITE_NAME,
          url: domain || "/",
        },
        ...(modules.length > 0
          ? {
              hasCourseInstance: modules.map((m) => ({
                "@type": "CourseInstance",
                name: m.title,
                ...(m.description ? { description: m.description } : {}),
                url: domain
                  ? `${domain}/courses/${course.slug}/modules/${m.slug}`
                  : `/courses/${course.slug}/modules/${m.slug}`,
              })),
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Courses",
            item: domain ? `${domain}/courses` : "/courses",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: course.title,
            item: courseUrl,
          },
        ],
      },
    ],
  };

  let courseHtml = injectBody(injectHead(template, meta), courseDetailBody(course, modules));
  courseHtml = injectJsonLd(courseHtml, courseLd);
  writeRoute(`/courses/${course.slug}`, courseHtml);
}

// ---------------------------------------------------------------------------
// 8. sitemap.xml — generated from live DB data + VITE_CANONICAL_DOMAIN
// ---------------------------------------------------------------------------
console.log("\nGenerating sitemap.xml and robots.txt…");
{
  const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  if (!domain) {
    console.warn(
      "  ⚠  VITE_CANONICAL_DOMAIN not set — sitemap <loc> values will be relative paths only.",
    );
  }

  const base = domain || "";

  /** Encode a bare URL (no escaping of slash/colon needed for <loc>). */
  function xmlEsc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function urlEntry({ loc, changefreq, priority }) {
    return [
      "  <url>",
      `    <loc>${xmlEsc(loc)}</loc>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      `    <lastmod>${now}</lastmod>`,
      "  </url>",
    ].join("\n");
  }

  const staticUrls = [
    { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/daily`, changefreq: "daily", priority: "0.9" },
    { loc: `${base}/courses`, changefreq: "weekly", priority: "0.8" },
    { loc: `${base}/about`, changefreq: "monthly", priority: "0.4" },
    { loc: `${base}/privacy`, changefreq: "monthly", priority: "0.3" },
  ];

  const categoryUrls = data.categories.map((cat) => ({
    loc: `${base}/category/${cat.slug}`,
    changefreq: "weekly",
    priority: cat.parent_id ? "0.7" : "0.8",
  }));

  const quizUrls = data.quizzes.map((quiz) => ({
    loc: `${base}/quiz/${quiz.id}`,
    changefreq: "monthly",
    priority: "0.6",
  }));

  const courseUrls = data.courses.map((course) => ({
    loc: `${base}/courses/${course.slug}`,
    changefreq: "monthly",
    priority: "0.7",
  }));

  const allUrls = [...staticUrls, ...categoryUrls, ...quizUrls, ...courseUrls];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    allUrls.map(urlEntry).join("\n") +
    `\n</urlset>\n`;

  writeFileSync(join(distDir, "sitemap.xml"), xml, "utf-8");
  console.log(
    `  ✓  sitemap.xml (${allUrls.length} URLs: ${data.quizzes.length} quizzes, ${data.categories.length} categories, ${data.courses.length} courses)`,
  );
}

// ---------------------------------------------------------------------------
// 9. robots.txt — generated with the correct canonical Sitemap URL
// ---------------------------------------------------------------------------
{
  const sitemapLine = domain ? `\nSitemap: ${domain}/sitemap.xml` : "";

  const robots =
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /sign-in\n` +
    `Disallow: /sign-up\n` +
    `Disallow: /profile\n` +
    `\n` +
    `# AI crawlers — public educational geography content is welcome to index\n` +
    `User-agent: GPTBot\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /sign-in\n` +
    `Disallow: /sign-up\n` +
    `Disallow: /profile\n` +
    `\n` +
    `User-agent: ClaudeBot\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /sign-in\n` +
    `Disallow: /sign-up\n` +
    `Disallow: /profile\n` +
    `\n` +
    `User-agent: PerplexityBot\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /sign-in\n` +
    `Disallow: /sign-up\n` +
    `Disallow: /profile\n` +
    `\n` +
    `User-agent: Applebot-Extended\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /sign-in\n` +
    `Disallow: /sign-up\n` +
    `Disallow: /profile\n` +
    sitemapLine +
    `\n`;

  writeFileSync(join(distDir, "robots.txt"), robots, "utf-8");
  console.log(
    `  ✓  robots.txt${domain ? ` (Sitemap: ${domain}/sitemap.xml)` : " (no VITE_CANONICAL_DOMAIN — Sitemap line omitted)"}`,
  );
}

console.log("\n✓ Prerender complete.");
