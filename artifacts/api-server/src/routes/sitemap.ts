import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  quizzesTable,
  categoriesTable,
  coursesTable,
  articlesTable,
} from "@workspace/db";
import { buildVisibleCategoryIds } from "../lib/categoryVisibility";

const router: IRouter = Router();

/**
 * GET /sitemap.xml
 *
 * Serves a dynamically generated sitemap from live database state.
 * This is always current — it reflects quizzes, categories, and courses
 * added since the last deployment.
 *
 * Category URLs apply the same ancestor-aware visibility rule used by the
 * public category pages: a category is only included when it AND every
 * ancestor in its chain are published. This prevents the sitemap from
 * advertising /category/{slug} URLs that would return 404 to crawlers.
 */
router.get("/sitemap.xml", async (req, res) => {
  const domain = (process.env.VITE_CANONICAL_DOMAIN ?? "").replace(/\/$/, "");
  const base = domain || `${req.protocol}://${req.get("host")}`;

  const [publishedQuizzes, allCategories, allCourses, publishedArticles] =
    await Promise.all([
      db
        .select({ id: quizzesTable.id })
        .from(quizzesTable)
        .where(eq(quizzesTable.published, true)),
      db.select().from(categoriesTable),
      db
        .select({ slug: coursesTable.slug })
        .from(coursesTable)
        .orderBy(coursesTable.orderIndex),
      db
        .select({ slug: articlesTable.slug })
        .from(articlesTable)
        .where(eq(articlesTable.published, true)),
    ]);

  const visibleCategoryIds = buildVisibleCategoryIds(allCategories);
  const publishedCategories = allCategories.filter((c) =>
    visibleCategoryIds.has(c.id),
  );

  const now = new Date().toISOString().split("T")[0];

  function xmlEsc(str: string) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function urlEntry({
    loc,
    changefreq,
    priority,
  }: {
    loc: string;
    changefreq: string;
    priority: string;
  }) {
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
    { loc: `${base}/did-you-know`, changefreq: "weekly", priority: "0.7" },
    { loc: `${base}/privacy`, changefreq: "monthly", priority: "0.3" },
  ];

  const categoryUrls = publishedCategories.map((cat) => ({
    loc: `${base}/category/${cat.slug}`,
    changefreq: "weekly",
    priority: cat.parentId ? "0.7" : "0.8",
  }));

  const quizUrls = publishedQuizzes.map((quiz) => ({
    loc: `${base}/quiz/${quiz.id}`,
    changefreq: "monthly",
    priority: "0.6",
  }));

  const courseUrls = allCourses.map((course) => ({
    loc: `${base}/courses/${course.slug}`,
    changefreq: "monthly",
    priority: "0.7",
  }));

  const articleUrls = publishedArticles.map((article) => ({
    loc: `${base}/did-you-know/${article.slug}`,
    changefreq: "monthly",
    priority: "0.6",
  }));

  const allUrls = [
    ...staticUrls,
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

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.send(xml);
});

export default router;
