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
import { getMetaDescription, SEO_ARTICLES } from "@workspace/seo-content";
// Crawlable page bodies come from the shared package so this script and the
// api-server SSR routes emit identical markup — edit them there, not here.
import {
  SITE_NAME,
  esc,
  homeBody,
  dailyBody,
  coursesBody,
  privacyBody,
  aboutBody,
  didYouKnowBody,
  articleDetailBody,
  quizBody,
  categoryBody,
  courseDetailBody,
  seoArticlesIndexBody,
  seoArticleBody,
  seoArticleJsonLd,
} from "@workspace/ssr-bodies";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist/public");

const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------

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

/** Write a prerendered file; creates parent directories as needed. */
function writeRoute(routePath, html) {
  const dir = join(distDir, routePath.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  console.log(`  ✓  ${routePath}`);
}

// ---------------------------------------------------------------------------
// Database queries
// ---------------------------------------------------------------------------

// Run a query against a table that may not exist in production yet.
//
// The prerender runs during the production *build*, but the schema push
// (drizzle-kit push, the Railway pre-deploy command) runs only AFTER a
// successful build. So the first deploy that introduces a new table cannot
// see that table here — it gets created later in the same deploy. Treat "relation does not exist"
// (Postgres 42P01) as an empty result so the build still succeeds and the
// publish can proceed; the table is created during that publish and the next
// build prerenders its routes. Any other error (connection, syntax, etc.)
// still propagates and fails the build.
async function queryOptionalTable(pool, sql, label) {
  try {
    return await pool.query(sql);
  } catch (err) {
    if (err && err.code === "42P01") {
      console.warn(
        `  ⚠ Skipping ${label}: table not in production yet (it will be created on publish).`,
      );
      return { rows: [] };
    }
    throw err;
  }
}

async function loadData(pool) {
  const [
    quizzesRes,
    categoriesRes,
    coursesRes,
    quizCatRes,
    modulesRes,
    factoidsRes,
    articlesRes,
  ] = await Promise.all([
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
      // Did You Know — published factoids (for the index page).
      // Optional: the table may not exist on the first publish that adds it.
      queryOptionalTable(
        pool,
        `SELECT text, source_label, source_url
         FROM factoids
         WHERE published = true
         ORDER BY created_at DESC`,
        "Did You Know factoids",
      ),
      // Did You Know — published articles (index + detail pages).
      // Optional: the table may not exist on the first publish that adds it.
      queryOptionalTable(
        pool,
        `SELECT slug, title, summary, body, image_url, created_at, updated_at
         FROM articles
         WHERE published = true
         ORDER BY created_at DESC`,
        "Did You Know articles",
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

  // Normalize snake_case pg rows to the camelCase shapes the shared
  // @workspace/ssr-bodies builders expect (matching the api-server's Drizzle
  // rows). `questions: []` is deliberate — the prerender path omits the
  // question listing; the runtime SSR route renders it.
  const quizzes = quizzesRes.rows.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    difficulty: q.difficulty,
    questionCount: q.question_count,
    questions: [],
  }));

  const quizMap = {};
  for (const q of quizzes) {
    quizMap[q.id] = { ...q, categories: quizCategories[q.id] ?? [] };
  }

  return {
    quizzes,
    quizMap,
    categories: categoriesRes.rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parent_id,
    })),
    categoryQuizIds,
    courses: coursesRes.rows,
    courseModules,
    factoids: factoidsRes.rows.map((f) => ({
      text: f.text,
      sourceLabel: f.source_label,
      sourceUrl: f.source_url,
    })),
    articles: articlesRes.rows.map((a) => ({
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      body: a.body,
      imageUrl: a.image_url,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })),
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
// 3b. Where's Atlas? (daily country-guessing game)
// ---------------------------------------------------------------------------
{
  const meta = {
    title: "Where's Atlas? — Daily Country Guessing Game",
    description:
      "Atlas the swallow has flown to a mystery country. Guess it in 6 tries using capital-to-capital distance and direction hints — a new puzzle every day.",
    path: "/guess-the-country",
  };
  // The game itself is fully client-rendered (it depends on the visitor's date
  // and localStorage), so the crawlable body is a hand-written static summary.
  // React replaces it with the live game on hydration.
  const body = `<main style="max-width:480px;margin:0 auto;padding:24px 16px">
    <h1>Where's Atlas?</h1>
    <p>A daily geography guessing game from ${esc(SITE_NAME)}. Atlas the swallow has flown to a mystery country — find it in six guesses using capital-to-capital distance and direction hints. A new puzzle every day, the same for everyone.</p>
    <p>Enable JavaScript to play today's puzzle.</p>
  </main>`;
  writeRoute("/guess-the-country", injectBody(injectHead(template, meta), body));
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
    `Test your knowledge with the "${quiz.title}" geography quiz. ${quiz.questionCount} multiple-choice questions.`;
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
  let current = catById[cat.parentId];
  while (current) {
    chain.unshift(current);
    current = catById[current.parentId];
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

  // Direct children only; data.categories is already visibility-filtered by
  // the recursive published-only query.
  const subcategories = data.categories.filter((c) => c.parentId === cat.id);
  let catHtml = injectBody(
    injectHead(template, meta),
    categoryBody(cat, ancestors, subcategories, quizzes),
  );
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
// 7b. Did You Know index (/did-you-know)
// ---------------------------------------------------------------------------
{
  const meta = {
    title: "Did You Know?",
    description:
      "Surprising geography facts and in-depth articles about countries, capitals, landmarks, and the natural world from World Geography Trivia.",
    path: "/did-you-know",
  };
  writeRoute(
    "/did-you-know",
    injectBody(
      injectHead(template, meta),
      didYouKnowBody(data.factoids, data.articles),
    ),
  );
}

// ---------------------------------------------------------------------------
// 7c. Did You Know article pages (/did-you-know/:slug)
// ---------------------------------------------------------------------------
console.log(`\nPrerendering ${data.articles.length} article pages…`);
for (const article of data.articles) {
  const description =
    article.summary ||
    `Read "${article.title}" on ${SITE_NAME} — a geography article exploring the world.`;
  const meta = {
    title: article.title,
    description,
    path: `/did-you-know/${article.slug}`,
  };

  const articleUrl = domain
    ? `${domain}/did-you-know/${article.slug}`
    : `/did-you-know/${article.slug}`;
  const articleLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description,
        url: articleUrl,
        ...(article.imageUrl ? { image: article.imageUrl } : {}),
        datePublished: new Date(article.createdAt).toISOString(),
        dateModified: new Date(article.updatedAt).toISOString(),
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: domain || "/",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Did You Know",
            item: domain ? `${domain}/did-you-know` : "/did-you-know",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: article.title,
            item: articleUrl,
          },
        ],
      },
    ],
  };

  let articleHtml = injectBody(
    injectHead(template, meta),
    articleDetailBody(article),
  );
  articleHtml = injectJsonLd(articleHtml, articleLd);
  writeRoute(`/did-you-know/${article.slug}`, articleHtml);
}

// ---------------------------------------------------------------------------
// 7d. SEO articles (/articles and /articles/:slug) — static editorial content
// from @workspace/seo-content, rendered with the same shared builders as the
// api-server SSR routes. Related quizzes resolve against the published quiz
// list already fetched above; missing ids are silently skipped.
// ---------------------------------------------------------------------------
{
  const meta = {
    title: "Articles",
    description:
      getMetaDescription("/articles") ??
      "Geography articles from World Geography Trivia — the stories behind the quizzes.",
    path: "/articles",
  };
  writeRoute(
    "/articles",
    injectBody(injectHead(template, meta), seoArticlesIndexBody(SEO_ARTICLES)),
  );
}

console.log(`\nPrerendering ${SEO_ARTICLES.length} SEO article pages…`);
for (const article of SEO_ARTICLES) {
  const meta = {
    title: article.title,
    description: article.metaDescription,
    path: `/articles/${article.slug}`,
  };
  const quizById = new Map(data.quizzes.map((q) => [q.id, q]));
  const relatedQuizzes = article.relatedQuizIds
    .map((id) => quizById.get(id))
    .filter(Boolean)
    .map((q) => ({
      id: q.id,
      title: q.title,
      questionCount: q.questionCount,
      difficulty: q.difficulty,
    }));
  const otherArticles = SEO_ARTICLES.filter((a) => a.slug !== article.slug);

  let articleHtml = injectBody(
    injectHead(template, meta),
    seoArticleBody(article, relatedQuizzes, otherArticles),
  );
  articleHtml = injectJsonLd(articleHtml, seoArticleJsonLd(article, domain));
  writeRoute(`/articles/${article.slug}`, articleHtml);
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
    { loc: `${base}/guess-the-country`, changefreq: "daily", priority: "0.9" },
    { loc: `${base}/courses`, changefreq: "weekly", priority: "0.8" },
    { loc: `${base}/articles`, changefreq: "weekly", priority: "0.8" },
    { loc: `${base}/did-you-know`, changefreq: "weekly", priority: "0.7" },
    { loc: `${base}/about`, changefreq: "monthly", priority: "0.4" },
    { loc: `${base}/privacy`, changefreq: "monthly", priority: "0.3" },
  ];

  const categoryUrls = data.categories.map((cat) => ({
    loc: `${base}/category/${cat.slug}`,
    changefreq: "weekly",
    priority: cat.parentId ? "0.7" : "0.8",
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

  const articleUrls = data.articles.map((article) => ({
    loc: `${base}/did-you-know/${article.slug}`,
    changefreq: "monthly",
    priority: "0.6",
  }));

  const seoArticleUrls = SEO_ARTICLES.map((article) => ({
    loc: `${base}/articles/${article.slug}`,
    changefreq: "monthly",
    priority: "0.7",
  }));

  const allUrls = [
    ...staticUrls,
    ...seoArticleUrls,
    ...categoryUrls,
    ...quizUrls,
    ...courseUrls,
    ...articleUrls,
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    allUrls.map(urlEntry).join("\n") +
    `\n</urlset>\n`;

  writeFileSync(join(distDir, "sitemap.xml"), xml, "utf-8");
  console.log(
    `  ✓  sitemap.xml (${allUrls.length} URLs: ${data.quizzes.length} quizzes, ${data.categories.length} categories, ${data.courses.length} courses, ${data.articles.length} articles)`,
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
