/**
 * SSR page routes for public quiz, category, and course discovery pages.
 *
 * These routes intercept /quiz/:id, /category/:slug, /courses, and
 * /courses/:slug BEFORE the static file server, so crawlers and social bots
 * always receive fresh HTML generated from the current database state —
 * not a prerendered snapshot that may have gone stale since the last deploy.
 *
 * The React SPA still hydrates on the client side (the template's JS bundle
 * is preserved), so end users get the full interactive experience.
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
} from "@workspace/db";
import { buildPageHtml, esc, sharedNav, getRawTemplate } from "../lib/ssrTemplate";
import { isRequestAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const SITE_NAME = "World Geography Trivia";
const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
} as const;

// ---------------------------------------------------------------------------
// Body builders — mirrors prerender.mjs body generators
// ---------------------------------------------------------------------------

function quizBody(quiz: {
  id: number;
  title: string;
  description: string | null;
  difficulty: string;
  questionCount: number;
  categories: { id: number; name: string; slug: string }[];
}): string {
  const cats = quiz.categories
    .map(
      (c) =>
        `<a href="/category/${esc(c.slug)}" style="color:#0e7490">${esc(c.name)}</a>`,
    )
    .join(", ");
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
    <dd style="display:inline;margin-left:0.25rem">${esc(quiz.questionCount)}</dd>
  </dl>
  <p><a href="/quiz/${esc(quiz.id)}" style="color:#fff;background:#0e7490;padding:0.5rem 1.25rem;border-radius:0.5rem;text-decoration:none;font-weight:600">Start Quiz →</a></p>
</main>`;
}

function categoryBody(
  category: { id: number; name: string; slug: string; parentId: number | null },
  quizzes: { id: number; title: string; difficulty: string }[],
): string {
  const items = quizzes
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
  ${
    items
      ? `<p style="color:#6b7280;margin-bottom:1rem">${esc(quizzes.length)} ${quizzes.length === 1 ? "quiz" : "quizzes"} in this category</p>
  <ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.5rem">
      ${items}
    </ul>`
      : `<p style="color:#6b7280">No quizzes in this category yet.</p>`
  }
</main>`;
}

function coursesListBody(
  courses: { slug: string; title: string; description: string | null }[],
): string {
  const items = courses
    .map(
      (c) =>
        `<li><a href="/courses/${esc(c.slug)}" style="color:#0e7490;font-weight:600">${esc(c.title)}</a>` +
        (c.description
          ? ` — <span style="color:#6b7280">${esc(c.description)}</span>`
          : "") +
        `</li>`,
    )
    .join("\n    ");
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Geography Courses</h1>
  <p style="color:#6b7280;margin-bottom:1.5rem">Learn geography through structured modules with explanations and fun facts.</p>
  ${items.length ? `<ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.5rem">\n    ${items}\n  </ul>` : ""}
</main>`;
}

function courseDetailBody(
  course: { slug: string; title: string; description: string | null },
  modules: { title: string; description: string | null }[],
): string {
  const modItems = modules
    .map(
      (m, i) =>
        `<li style="padding:0.5rem 0;border-bottom:1px solid #f3f4f6">` +
        `<span style="color:#6b7280;font-size:0.8rem;margin-right:0.5rem">${i + 1}.</span>` +
        `<strong>${esc(m.title)}</strong>` +
        (m.description
          ? ` — <span style="color:#6b7280">${esc(m.description)}</span>`
          : "") +
        `</li>`,
    )
    .join("\n    ");
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
    <a href="/" style="color:#0e7490">Home</a> › <a href="/courses" style="color:#0e7490">Courses</a> › ${esc(course.title)}
  </nav>
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(course.title)}</h1>
  ${course.description ? `<p style="color:#6b7280;margin-bottom:1.5rem">${esc(course.description)}</p>` : ""}
  ${
    modItems
      ? `<h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.75rem">Modules</h2>
  <ul style="padding:0;list-style:none">
    ${modItems}
  </ul>`
      : ""
  }
</main>`;
}

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

  const [quizRows, questionCountRows, catRows] = await Promise.all([
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

  const description =
    quiz.description ||
    `Test your knowledge with the "${quiz.title}" geography quiz. ${questionCount} multiple-choice questions.`;

  const html = buildPageHtml(
    { title: quiz.title, description, path: `/quiz/${quiz.id}` },
    quizBody({ ...quiz, questionCount, categories }),
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /category/:slug
// ---------------------------------------------------------------------------

router.get("/category/:slug", async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const admin = isRequestAdmin(req);

  const catRows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      parentId: categoriesTable.parentId,
      published: categoriesTable.published,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug))
    .limit(1);

  const category = catRows[0];
  if (!category || (!category.published && !admin)) {
    res.status(404).end();
    return;
  }

  // Fetch quizzes in this category (only published quizzes for non-admins)
  const quizRows = await db
    .select({
      id: quizzesTable.id,
      title: quizzesTable.title,
      difficulty: quizzesTable.difficulty,
      published: quizzesTable.published,
    })
    .from(quizCategoriesTable)
    .innerJoin(quizzesTable, eq(quizCategoriesTable.quizId, quizzesTable.id))
    .where(eq(quizCategoriesTable.categoryId, category.id));

  const quizzes = quizRows.filter((q) => admin || q.published);

  const description =
    quizzes.length > 0
      ? `Explore ${quizzes.length} ${quizzes.length === 1 ? "quiz" : "quizzes"} in the ${category.name} category on ${SITE_NAME}.`
      : `Browse the ${category.name} category on ${SITE_NAME}.`;

  const html = buildPageHtml(
    {
      title: category.name,
      description,
      path: `/category/${category.slug}`,
    },
    categoryBody(category, quizzes),
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

  const html = buildPageHtml(
    {
      title: "Geography Courses",
      description:
        "Learn world geography through structured courses. Master modules on capitals, regions, landmarks, and more — each course builds knowledge step by step.",
      path: "/courses",
    },
    coursesListBody(courses),
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

  const html = buildPageHtml(
    {
      title: course.title,
      description,
      path: `/courses/${course.slug}`,
    },
    courseDetailBody(course, modules),
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Catch-all fallbacks — serve the SPA template for subroutes that are not
// handled by the specific SSR handlers above.
//
// Because the artifact.toml routes /quiz, /category, and /courses to this
// server as prefix paths, deeper SPA routes like /quiz/:id/results or
// /courses/:slug/modules/:moduleSlug also land here. Those routes are
// client-side-only, so we must serve the raw index.html so the React app
// can take over. Without these, unmatched subroutes return 404.
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
    // Template not available (dev without a build) — redirect to the frontend
    res.redirect(302, "/");
  }
}

router.get("/quiz/*splat", (_req: Request, res: Response) => serveSpaFallback(res));
router.get("/category/*splat", (_req: Request, res: Response) =>
  serveSpaFallback(res),
);
router.get("/courses/*splat", (_req: Request, res: Response) =>
  serveSpaFallback(res),
);

export default router;
