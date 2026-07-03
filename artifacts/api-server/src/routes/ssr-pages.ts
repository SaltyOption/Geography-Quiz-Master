/**
 * SSR page routes for public quiz, category, course, and homepage discovery.
 *
 * These routes intercept /, /quiz/:id, /category/:slug, /courses, and
 * /courses/:slug BEFORE the static file server, so crawlers and social bots
 * always receive fresh HTML generated from the current database state —
 * not a prerendered snapshot that may have gone stale since the last deploy.
 *
 * The React SPA still hydrates on the client side (the template's JS bundle
 * is preserved), so end users get the full interactive experience.
 *
 * The HTML bodies come from @workspace/ssr-bodies — the same builders the
 * prerender script (artifacts/geo-quiz/prerender.mjs) uses at build time —
 * so both render paths emit identical markup. This file only fetches data
 * (via Drizzle), applies admin/draft visibility, and assembles JSON-LD.
 *
 * Cache-Control is set to short TTLs: fresh enough for crawlers, aggressive
 * enough not to saturate the DB on high-traffic pages.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  quizzesTable,
  questionsTable,
  categoriesTable,
  quizCategoriesTable,
  coursesTable,
  courseModulesTable,
  articlesTable,
  factoidsTable,
} from "@workspace/db";
import {
  SITE_NAME,
  aboutBody,
  articleDetailBody,
  categoryBody,
  courseDetailBody,
  coursesBody,
  dailyBody,
  didYouKnowBody,
  homeBody,
  privacyBody,
  quizBody,
} from "@workspace/ssr-bodies";
import { buildPageHtml, getRawTemplate } from "../lib/ssrTemplate";
import { collectDescendantIds } from "../lib/categoryTree";
import { isRequestAdmin } from "../middlewares/requireAdmin";
import { buildVisibleCategoryIds, isCategoryVisible, type CategoryRow } from "../lib/categoryVisibility";

const router: IRouter = Router();

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
} as const;

// ---------------------------------------------------------------------------
// Route: GET /quiz/:id
// ---------------------------------------------------------------------------

router.get("/quiz/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(404).end();
    return;
  }

  const admin = isRequestAdmin(req);

  const [quizRows, questionCountRows, catRows, questionRows] = await Promise.all([
    db
      .select({
        id: quizzesTable.id,
        title: quizzesTable.title,
        description: quizzesTable.description,
        difficulty: quizzesTable.difficulty,
        published: quizzesTable.published,
      })
      .from(quizzesTable)
      .where(eq(quizzesTable.id, id))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(questionsTable)
      .where(eq(questionsTable.quizId, id)),
    db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        published: categoriesTable.published,
      })
      .from(quizCategoriesTable)
      .innerJoin(
        categoriesTable,
        eq(quizCategoriesTable.categoryId, categoriesTable.id),
      )
      .where(eq(quizCategoriesTable.quizId, id)),
    db
      .select({
        text: questionsTable.text,
        options: questionsTable.options,
        imageUrl: questionsTable.imageUrl,
        orderIndex: questionsTable.orderIndex,
      })
      .from(questionsTable)
      .where(eq(questionsTable.quizId, id))
      .orderBy(questionsTable.orderIndex),
  ]);

  const quiz = quizRows[0];
  if (!quiz || (!quiz.published && !admin)) {
    res.status(404).end();
    return;
  }

  const questionCount = questionCountRows[0]?.count ?? 0;
  const categories = catRows.filter((c) => admin || c.published).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const questions = questionRows.map((q) => ({
    text: q.text,
    options: q.options as string[],
    imageUrl: q.imageUrl,
  }));

  const description =
    quiz.description ||
    `Test your knowledge with the "${quiz.title}" geography quiz. ${questionCount} multiple-choice questions.`;

  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const url = (p: string) => (domain ? `${domain}${p}` : p);

  const primaryCategory = categories[0];
  const breadcrumbItems: object[] = [
    { "@type": "ListItem", position: 1, name: "Home", item: url("/") },
  ];
  if (primaryCategory) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: primaryCategory.name,
      item: url(`/category/${primaryCategory.slug}`),
    });
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: quiz.title,
      item: url(`/quiz/${quiz.id}`),
    });
  } else {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: quiz.title,
      item: url(`/quiz/${quiz.id}`),
    });
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  const html = buildPageHtml(
    { title: quiz.title, description, path: `/quiz/${quiz.id}` },
    quizBody({ ...quiz, questionCount, categories, questions }),
    breadcrumbLd,
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /category/:slug
// ---------------------------------------------------------------------------

router.get("/category/:slug", async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const admin = isRequestAdmin(req);

  const allCategories = await db.select().from(categoriesTable);
  const byId = new Map(allCategories.map((c) => [c.id, c]));

  const category = allCategories.find((c) => c.slug === slug);
  if (!category) {
    res.status(404).end();
    return;
  }

  const isVisible = (c: CategoryRow) => admin || isCategoryVisible(c, byId);

  if (!isVisible(category)) {
    res.status(404).end();
    return;
  }

  // Ancestor chain (root → … → parent), for breadcrumb
  const ancestors: { id: number; name: string; slug: string }[] = [];
  let cursor: number | null = category.parentId;
  const seen = new Set<number>();
  while (cursor !== null) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const anc = byId.get(cursor);
    if (!anc) break;
    ancestors.unshift({ id: anc.id, name: anc.name, slug: anc.slug });
    cursor = anc.parentId;
  }

  // Direct visible children, for subcategory links
  const directChildren = allCategories.filter(
    (c) => c.parentId === category.id && isVisible(c),
  ).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

  // Descendants (BFS) — for the descendant-inclusive quiz query
  const descendantIds = collectDescendantIds(category.id, allCategories);
  const visibleDescendantIds = descendantIds.filter((did) => {
    const d = byId.get(did);
    return d && isVisible(d);
  });

  // Quizzes: this category + all visible descendants
  const includedCategoryIds = [category.id, ...visibleDescendantIds];
  const links = await db
    .select({ quizId: quizCategoriesTable.quizId })
    .from(quizCategoriesTable)
    .where(inArray(quizCategoriesTable.categoryId, includedCategoryIds));
  const quizIds = Array.from(new Set(links.map((l) => l.quizId)));

  let quizzes: { id: number; title: string; difficulty: string }[] = [];
  if (quizIds.length > 0) {
    const allRows = await db
      .select({
        id: quizzesTable.id,
        title: quizzesTable.title,
        difficulty: quizzesTable.difficulty,
        published: quizzesTable.published,
      })
      .from(quizzesTable)
      .where(inArray(quizzesTable.id, quizIds));
    quizzes = (admin ? allRows : allRows.filter((q) => q.published))
      .map((q) => ({ id: q.id, title: q.title, difficulty: q.difficulty }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  const description =
    quizzes.length > 0
      ? `Explore ${quizzes.length} ${quizzes.length === 1 ? "quiz" : "quizzes"} in the ${category.name} category on ${SITE_NAME}.`
      : `Browse the ${category.name} category on ${SITE_NAME}.`;

  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const catUrl = (p: string) => (domain ? `${domain}${p}` : p);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "All Quizzes",
        item: catUrl("/"),
      },
      ...ancestors.map((a, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: a.name,
        item: catUrl(`/category/${a.slug}`),
      })),
      {
        "@type": "ListItem",
        position: ancestors.length + 2,
        name: category.name,
        item: catUrl(`/category/${category.slug}`),
      },
    ],
  };

  const html = buildPageHtml(
    {
      title: category.name,
      description,
      path: `/category/${category.slug}`,
    },
    categoryBody(category, ancestors, directChildren, quizzes),
    breadcrumbLd,
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /courses  (listing page)
// ---------------------------------------------------------------------------

router.get("/courses", async (_req: Request, res: Response) => {
  const courses = await db
    .select({
      id: coursesTable.id,
      slug: coursesTable.slug,
      title: coursesTable.title,
      description: coursesTable.description,
    })
    .from(coursesTable)
    .orderBy(coursesTable.orderIndex);

  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const courseUrl = (p: string) => (domain ? `${domain}${p}` : p);

  const itemListLd =
    courses.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Geography Courses",
          description:
            "Learn world geography through structured courses covering capitals, regions, landmarks, and more.",
          url: courseUrl("/courses"),
          numberOfItems: courses.length,
          itemListElement: courses.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: courseUrl(`/courses/${c.slug}`),
            name: c.title,
          })),
        }
      : undefined;

  const html = buildPageHtml(
    {
      title: "Geography Courses",
      description:
        "Learn world geography through structured courses. Master modules on capitals, regions, landmarks, and more — each course builds knowledge step by step.",
      path: "/courses",
    },
    coursesBody(courses),
    itemListLd,
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /courses/:slug
// ---------------------------------------------------------------------------

router.get("/courses/:slug", async (req: Request, res: Response) => {
  const slug = req.params.slug as string;

  const courseRows = await db
    .select({
      id: coursesTable.id,
      slug: coursesTable.slug,
      title: coursesTable.title,
      description: coursesTable.description,
    })
    .from(coursesTable)
    .where(eq(coursesTable.slug, slug))
    .limit(1);

  const course = courseRows[0];
  if (!course) {
    res.status(404).end();
    return;
  }

  const modules = await db
    .select({
      title: courseModulesTable.title,
      description: courseModulesTable.description,
    })
    .from(courseModulesTable)
    .where(eq(courseModulesTable.courseId, course.id))
    .orderBy(courseModulesTable.orderIndex);

  const description =
    course.description ||
    `Study ${course.title} on ${SITE_NAME}. Work through structured modules with explanations and fun facts to master geography step by step.`;

  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const url = (p: string) => (domain ? `${domain}${p}` : p);
  const courseUrl = url(`/courses/${course.slug}`);

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
            item: url("/courses"),
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

  const html = buildPageHtml(
    {
      title: course.title,
      description,
      path: `/courses/${course.slug}`,
    },
    courseDetailBody(course, modules),
    courseLd,
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /  (homepage — live category + course inventory)
//
// This intercepts the homepage before the static file server so crawlers
// always see the current published category/course tree, not a snapshot
// frozen at the last deploy. The ancestor-aware visibility filter matches
// the same rules used by /category/:slug and the sitemap.
// ---------------------------------------------------------------------------

router.get("/", async (_req: Request, res: Response) => {
  const [allCategories, courses] = await Promise.all([
    db.select().from(categoriesTable),
    db
      .select({ id: coursesTable.id, slug: coursesTable.slug, title: coursesTable.title })
      .from(coursesTable)
      .orderBy(coursesTable.orderIndex),
  ]);

  const visibleIds = buildVisibleCategoryIds(allCategories);
  const visibleCategories = allCategories.filter((c) => visibleIds.has(c.id));

  const html = buildPageHtml(
    {
      title: SITE_NAME,
      description:
        "Play world geography quizzes and short courses covering capitals, countries, landmarks, and regions.",
      path: "/",
    },
    homeBody(visibleCategories, courses),
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /daily
// ---------------------------------------------------------------------------

router.get("/daily", (_req: Request, res: Response) => {
  const html = buildPageHtml(
    {
      title: "Daily Quiz",
      description:
        "Take today's daily geography quiz on World Geography Trivia. A new quiz every day — test your knowledge of capitals, countries, landmarks, and regions.",
      path: "/daily",
    },
    dailyBody(),
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /privacy
// ---------------------------------------------------------------------------

router.get("/privacy", (_req: Request, res: Response) => {
  const html = buildPageHtml(
    {
      title: "Privacy Policy",
      description:
        "Read the World Geography Trivia privacy policy. We never sell your data, collect only what we need to run the site, and let you delete your account at any time.",
      path: "/privacy",
    },
    privacyBody(),
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /about
// ---------------------------------------------------------------------------

router.get("/about", (_req: Request, res: Response) => {
  const html = buildPageHtml(
    {
      title: "About",
      description:
        "World Geography Trivia makes geography fun with quizzes on capitals, flags, countries, and landmarks — for travelers, students, teachers, and lifelong learners.",
      path: "/about",
    },
    aboutBody(),
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /did-you-know  (factoids + article index)
// ---------------------------------------------------------------------------

router.get("/did-you-know", async (req: Request, res: Response) => {
  const admin = isRequestAdmin(req);

  const [allFactoids, allArticles] = await Promise.all([
    db
      .select({
        text: factoidsTable.text,
        sourceLabel: factoidsTable.sourceLabel,
        sourceUrl: factoidsTable.sourceUrl,
        published: factoidsTable.published,
      })
      .from(factoidsTable)
      .orderBy(sql`${factoidsTable.createdAt} DESC`),
    db
      .select({
        slug: articlesTable.slug,
        title: articlesTable.title,
        summary: articlesTable.summary,
        published: articlesTable.published,
      })
      .from(articlesTable)
      .orderBy(sql`${articlesTable.createdAt} DESC`),
  ]);

  const factoids = admin ? allFactoids : allFactoids.filter((f) => f.published);
  const articles = admin ? allArticles : allArticles.filter((a) => a.published);

  const html = buildPageHtml(
    {
      title: "Did You Know?",
      description:
        "Surprising geography facts and in-depth articles about countries, capitals, landmarks, and the natural world from World Geography Trivia.",
      path: "/did-you-know",
    },
    didYouKnowBody(factoids, articles),
  );

  res.set(HTML_HEADERS).send(html);
});

router.get("/did-you-know/:slug", async (req: Request, res: Response) => {
  const admin = isRequestAdmin(req);
  const slug = req.params.slug as string;

  const [article] = await db
    .select()
    .from(articlesTable)
    .where(eq(articlesTable.slug, slug))
    .limit(1);

  if (!article || (!article.published && !admin)) {
    res.status(404).end();
    return;
  }

  const description =
    article.summary ||
    `Read "${article.title}" on ${SITE_NAME} — a geography article exploring the world.`;

  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const url = (p: string) => (domain ? `${domain}${p}` : p);
  const articleUrl = url(`/did-you-know/${article.slug}`);

  const articleLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description,
        url: articleUrl,
        ...(article.imageUrl ? { image: article.imageUrl } : {}),
        datePublished: article.createdAt.toISOString(),
        dateModified: article.updatedAt.toISOString(),
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
            item: url("/did-you-know"),
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

  const html = buildPageHtml(
    {
      title: article.title,
      description,
      path: `/did-you-know/${article.slug}`,
    },
    articleDetailBody(article),
    articleLd,
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Catch-all fallbacks — serve the SPA template for subroutes that are not
// handled by the specific SSR handlers above.
//
// The artifact.toml routes /, /quiz, /category, /courses, /sitemap.xml, and
// /api to this server. Deeper SPA-only routes (/quiz/:id/results, /profile,
// /admin/*, etc.) land here and must receive index.html so the React
// app can take over client-side. Without this catch-all, unmatched routes
// return 404.
// ---------------------------------------------------------------------------

const SPA_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

function serveSpaFallback(res: Response): void {
  const template = getRawTemplate();
  if (template) {
    res.set(SPA_HEADERS).send(template);
  } else {
    // Template not available (dev without a build): serve a minimal prompt.
    // Run `pnpm --filter @workspace/geo-quiz run build` to enable the full SPA.
    res.set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>World Geography Trivia</title></head>` +
        `<body><p>Frontend not built. Run <code>pnpm --filter @workspace/geo-quiz run build</code> to enable the full app.</p></body></html>`,
    );
  }
}

router.get("/quiz/*splat", (_req: Request, res: Response) => serveSpaFallback(res));
router.get("/category/*splat", (_req: Request, res: Response) =>
  serveSpaFallback(res),
);
router.get("/courses/*splat", (_req: Request, res: Response) =>
  serveSpaFallback(res),
);
// Root catch-all: handles /profile, /admin/*, /daily, /privacy, and any other
// SPA routes that aren't covered by a specific SSR handler above.
router.get("/*splat", (_req: Request, res: Response) => serveSpaFallback(res));

export default router;
