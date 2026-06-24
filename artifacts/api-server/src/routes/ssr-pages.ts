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
import { RESPONSIVE_IMAGE_WIDTHS } from "@workspace/image-config";
import { renderMarkdown } from "@workspace/markdown";
import { buildPageHtml, esc, sharedNav, getRawTemplate } from "../lib/ssrTemplate";
import { isRequestAdmin } from "../middlewares/requireAdmin";
import { buildVisibleCategoryIds, isCategoryVisible, type CategoryRow } from "../lib/categoryVisibility";

const router: IRouter = Router();

const SITE_NAME = "World Geography Trivia";
const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function collectDescendantIds(
  rootId: number,
  all: { id: number; parentId: number | null }[],
): number[] {
  const descendantIds: number[] = [];
  const queue: number[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of all) {
      if (c.parentId === id) {
        descendantIds.push(c.id);
        queue.push(c.id);
      }
    }
  }
  return descendantIds;
}

// ---------------------------------------------------------------------------
// Body builders — mirrors prerender.mjs body generators
// ---------------------------------------------------------------------------

function homeBody(
  categories: CategoryRow[],
  courses: { id: number; slug: string; title: string }[],
): string {
  const visibleIds = buildVisibleCategoryIds(categories);
  const visible = categories.filter((c) => visibleIds.has(c.id));

  const byId = new Map(visible.map((c) => [c.id, c]));
  const roots: (CategoryRow & { children: CategoryRow[] })[] = [];
  const childrenMap = new Map<number, CategoryRow[]>();

  for (const c of visible) {
    if (c.parentId === null) {
      roots.push({ ...c, children: [] });
    } else if (byId.has(c.parentId)) {
      const list = childrenMap.get(c.parentId) ?? [];
      list.push(c);
      childrenMap.set(c.parentId, list);
    }
  }

  const categorySections = roots
    .map((root) => {
      const children = childrenMap.get(root.id) ?? [];
      const childLinks = children
        .map(
          (child) =>
            `<li><a href="/category/${esc(child.slug)}" style="color:#0e7490">${esc(child.name)}</a></li>`,
        )
        .join("\n        ");
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

// Width list comes from the shared @workspace/image-config module so it stays
// in sync with the generator (artifacts/geo-quiz/optimize-images.mjs) and the
// client component (artifacts/geo-quiz/src/components/ResponsiveImage.tsx). The
// naming convention here must still match those consumers.
const SSR_IMG_WIDTHS = RESPONSIVE_IMAGE_WIDTHS;
const SSR_IMG_OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];

function ssrImgSrcSet(rawPath: string, format: "avif" | "webp"): string {
  const dot = rawPath.lastIndexOf(".");
  const stem = rawPath.slice(0, dot);
  return SSR_IMG_WIDTHS.map((w) => `${stem}-${w}.${format} ${w}w`).join(", ");
}

// Renders a question image as a <picture> with AVIF + WebP sources for
// locally-hosted (pre-optimized) images, falling back to a plain <img> for
// external URLs. Mirrors the client ResponsiveImage component.
function questionImageHtml(imageUrl: string | null): string {
  if (!imageUrl) return "";
  const imgStyle = "max-width:100%;border-radius:0.375rem;margin-bottom:0.75rem";
  const optimizable = SSR_IMG_OPTIMIZED_PREFIXES.some((p) => imageUrl.startsWith(p));
  if (!optimizable) {
    return `<img src="${esc(imageUrl)}" alt="" style="${imgStyle}" loading="lazy">`;
  }
  const sizes = "(min-width: 768px) 600px, 90vw";
  return (
    `<picture>` +
    `<source type="image/avif" srcset="${esc(ssrImgSrcSet(imageUrl, "avif"))}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${esc(ssrImgSrcSet(imageUrl, "webp"))}" sizes="${sizes}">` +
    `<img src="${esc(imageUrl)}" alt="" style="${imgStyle}" loading="lazy">` +
    `</picture>`
  );
}

function quizBody(quiz: {
  id: number;
  title: string;
  description: string | null;
  difficulty: string;
  questionCount: number;
  categories: { id: number; name: string; slug: string }[];
  questions: { text: string; options: string[]; imageUrl: string | null }[];
}): string {
  const cats = quiz.categories
    .map(
      (c) =>
        `<a href="/category/${esc(c.slug)}" style="color:#0e7490">${esc(c.name)}</a>`,
    )
    .join(", ");

  const questionItems = quiz.questions
    .map((q, i) => {
      const optionItems = q.options
        .map(
          (opt) =>
            `<li style="padding:0.25rem 0;color:#374151">• ${esc(opt)}</li>`,
        )
        .join("\n          ");
      return (
        `<div style="margin-bottom:1.25rem;padding:1rem;background:#f9fafb;border-radius:0.5rem;border:1px solid #e5e7eb">` +
        questionImageHtml(q.imageUrl) +
        `<p style="font-weight:600;margin:0 0 0.5rem"><span style="color:#9ca3af;font-size:0.8rem">Q${i + 1}.</span> ${esc(q.text)}</p>` +
        `<ul style="padding:0;list-style:none;margin:0">
          ${optionItems}
        </ul>` +
        `</div>`
      );
    })
    .join("\n  ");

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
  ${questionItems ? `<section aria-label="Quiz questions" style="margin-top:2rem">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:1rem">Questions in this quiz</h2>
    ${questionItems}
  </section>` : ""}
</main>`;
}

function categoryBody(
  category: { id: number; name: string; slug: string; parentId: number | null },
  ancestors: { id: number; name: string; slug: string }[],
  subcategories: { id: number; name: string; slug: string }[],
  quizzes: { id: number; title: string; difficulty: string }[],
): string {
  const breadcrumbs =
    [
      `<a href="/" style="color:#0e7490">Home</a>`,
      ...ancestors.map(
        (a) => `<a href="/category/${esc(a.slug)}" style="color:#0e7490">${esc(a.name)}</a>`,
      ),
      esc(category.name),
    ].join(" › ");

  const subcategoryItems = subcategories
    .map(
      (s) =>
        `<li><a href="/category/${esc(s.slug)}" style="color:#0e7490;font-weight:600">${esc(s.name)}</a></li>`,
    )
    .join("\n      ");

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
    ${breadcrumbs}
  </nav>
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(category.name)}</h1>
  ${subcategoryItems ? `<section aria-label="Subcategories" style="margin-bottom:1.5rem">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">Subcategories</h2>
    <ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.25rem">
      ${subcategoryItems}
    </ul>
  </section>` : ""}
  ${
    quizItems
      ? `<section aria-label="Quizzes">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">${esc(quizzes.length)} ${quizzes.length === 1 ? "quiz" : "quizzes"}</h2>
    <ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.5rem">
      ${quizItems}
    </ul>
  </section>`
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
    coursesListBody(courses),
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

  const html = buildPageHtml(
    {
      title: SITE_NAME,
      description:
        "Play world geography quizzes and short courses covering capitals, countries, landmarks, and regions.",
      path: "/",
    },
    homeBody(allCategories, courses),
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
    `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Daily Quiz</h1>
  <p style="color:#6b7280">A new geography quiz every day. Test your knowledge of capitals, countries, landmarks, and regions.</p>
  <p style="margin-top:1rem"><a href="/daily" style="color:#0e7490;font-weight:600">Take today's quiz →</a></p>
</main>`,
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
    `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Privacy Policy</h1>
  <p style="color:#6b7280">We never sell your data. We collect only what we need to run the site, and you can delete your account at any time.</p>
  <p style="margin-top:1rem"><a href="/" style="color:#0e7490">Back to home →</a></p>
</main>`,
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /about
// ---------------------------------------------------------------------------

router.get("/about", (_req: Request, res: Response) => {
  const paras = [
    "World Geography Trivia helps curious learners explore the world one quiz at a time.",
    "Whether you are brushing up on capitals, testing your knowledge of flags, learning where countries are located, or discovering famous landmarks, this site is designed to make geography feel fun, approachable, and memorable.",
    "The goal is simple: help you build real geographic knowledge without making it feel like homework. Each quiz is meant to teach as well as test, with questions that encourage you to notice patterns, make connections, and learn something new about the world.",
    "World Geography Trivia is for travelers, lifelong learners, trivia fans, students, teachers, and anyone who has ever looked at a map and thought, “I should probably know more about that place.”",
    "So pick a quiz, follow your curiosity, and see where in the world it takes you.",
  ]
    .map((p) => `<p style="color:#6b7280;margin-bottom:1rem">${esc(p)}</p>`)
    .join("\n  ");

  const html = buildPageHtml(
    {
      title: "About",
      description:
        "World Geography Trivia makes geography fun with quizzes on capitals, flags, countries, and landmarks — for travelers, students, teachers, and lifelong learners.",
      path: "/about",
    },
    `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:1rem">About World Geography Trivia</h1>
  ${paras}
  <p style="margin-top:1rem"><a href="/" style="color:#0e7490">Browse quizzes →</a></p>
</main>`,
  );

  res.set(HTML_HEADERS).send(html);
});

// ---------------------------------------------------------------------------
// Route: GET /did-you-know  (factoids + article index)
// ---------------------------------------------------------------------------

function didYouKnowBody(
  factoids: { text: string; sourceLabel: string | null; sourceUrl: string | null }[],
  articles: { slug: string; title: string; summary: string | null }[],
): string {
  const factoidItems = factoids
    .map((f) => {
      const src =
        f.sourceUrl && /^https?:\/\//i.test(f.sourceUrl)
          ? ` <a href="${esc(f.sourceUrl)}" rel="noopener noreferrer" style="color:#0e7490;font-size:0.8rem">${esc(f.sourceLabel || "Source")}</a>`
          : f.sourceLabel
            ? ` <span style="color:#9ca3af;font-size:0.8rem">— ${esc(f.sourceLabel)}</span>`
            : "";
      return `<li style="padding:0.75rem 0;border-bottom:1px solid #f3f4f6"><span style="color:#374151">${esc(f.text)}</span>${src}</li>`;
    })
    .join("\n      ");

  const articleItems = articles
    .map(
      (a) =>
        `<li style="padding:0.5rem 0"><a href="/did-you-know/${esc(a.slug)}" style="color:#0e7490;font-weight:600">${esc(a.title)}</a>` +
        (a.summary ? ` — <span style="color:#6b7280">${esc(a.summary)}</span>` : "") +
        `</li>`,
    )
    .join("\n      ");

  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Did You Know?</h1>
  <p style="color:#6b7280;margin-bottom:1.5rem">Surprising geography facts and in-depth articles about our world.</p>
  ${
    factoidItems
      ? `<section aria-label="Geography facts" style="margin-bottom:2rem">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">Quick Facts</h2>
    <ul style="padding:0;list-style:none">
      ${factoidItems}
    </ul>
  </section>`
      : ""
  }
  ${
    articleItems
      ? `<section aria-label="Articles" style="margin-bottom:2rem">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">Articles</h2>
    <ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.25rem">
      ${articleItems}
    </ul>
  </section>`
      : ""
  }
</main>`;
}

function articleDetailBody(article: {
  title: string;
  summary: string | null;
  body: string;
  imageUrl: string | null;
}): string {
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
    <a href="/" style="color:#0e7490">Home</a> › <a href="/did-you-know" style="color:#0e7490">Did You Know</a>
  </nav>
  <article>
    <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(article.title)}</h1>
    ${article.summary ? `<p style="color:#6b7280;margin-bottom:1.5rem">${esc(article.summary)}</p>` : ""}
    ${article.imageUrl ? `<img src="${esc(article.imageUrl)}" alt="${esc(article.title)}" style="max-width:100%;height:auto;border-radius:0.5rem;margin-bottom:1.5rem" />` : ""}
    <div>${renderMarkdown(article.body)}</div>
  </article>
</main>`;
}

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
