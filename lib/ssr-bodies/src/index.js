/**
 * Shared SSR/prerender body builders for the public pages.
 *
 * One source of truth for the crawlable HTML injected into <div id="root">
 * by both server-rendering paths so their output stays identical:
 *   - the prerender script (artifacts/geo-quiz/prerender.mjs), at build time
 *   - the api-server SSR routes (artifacts/api-server ssr-pages), at request time
 *
 * Builders accept plain data (already fetched AND already filtered for
 * draft/admin visibility by the caller) and return HTML strings. There is no
 * database access and no framework dependency here — data fetching and
 * visibility filtering stay with each consumer.
 *
 * The React SPA replaces this markup on hydration; non-JS crawlers see it in
 * full, so keep it semantic and keep links crawlable.
 */

import { escapeHtml, renderMarkdown } from "@workspace/markdown";
import { RESPONSIVE_IMAGE_WIDTHS } from "@workspace/image-config";

export const SITE_NAME = "World Geography Trivia";

/** Minimal HTML-attribute and text escaping for injected values. */
export function esc(str) {
  return escapeHtml(str);
}

/** Build a minimal shared nav that's consistent across prerendered/SSR pages. */
export function sharedNav() {
  return `<header style="border-bottom:1px solid #e5e7eb;padding:0.75rem 1rem;background:#fff">
    <a href="/" style="font-weight:700;color:#0e7490;text-decoration:none">${esc(SITE_NAME)}</a>
  </header>`;
}

/** Wrap body content in the shared nav + centered <main> used by every page. */
function pageMain(inner) {
  return `${sharedNav()}<main style="padding:2rem 1rem;max-width:48rem;margin:0 auto">
${inner}
</main>`;
}

// ---------------------------------------------------------------------------
// Shared prose
// ---------------------------------------------------------------------------

/**
 * About page prose — the single source of truth for the words. Shared with
 * the React About page (artifacts/geo-quiz/src/pages/about.tsx); the markup
 * stays per-renderer, only the copy is shared.
 */
export const ABOUT_PARAGRAPHS = [
  "World Geography Trivia helps curious learners explore the world one quiz at a time.",
  "Whether you are brushing up on capitals, testing your knowledge of flags, learning where countries are located, or discovering famous landmarks, this site is designed to make geography feel fun, approachable, and memorable.",
  "The goal is simple: help you build real geographic knowledge without making it feel like homework. Each quiz is meant to teach as well as test, with questions that encourage you to notice patterns, make connections, and learn something new about the world.",
  "World Geography Trivia is for travelers, lifelong learners, trivia fans, students, teachers, and anyone who has ever looked at a map and thought, “I should probably know more about that place.”",
  "So pick a quiz, follow your curiosity, and see where in the world it takes you.",
];

// ---------------------------------------------------------------------------
// Static page bodies
// ---------------------------------------------------------------------------

export function dailyBody() {
  return pageMain(`  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Daily Quiz</h1>
  <p style="color:#6b7280">A new geography quiz every day. Test your knowledge of capitals, countries, landmarks, and regions.</p>
  <p style="margin-top:1rem"><a href="/daily" style="color:#0e7490;font-weight:600">Take today's quiz →</a></p>`);
}

export function privacyBody() {
  return pageMain(`  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Privacy Policy</h1>
  <p style="color:#6b7280">We never sell your data. We collect only what we need to run the site, and you can delete your account at any time.</p>
  <p style="margin-top:1rem"><a href="/" style="color:#0e7490">Back to home →</a></p>`);
}

export function aboutBody() {
  const paras = ABOUT_PARAGRAPHS
    .map((p) => `<p style="color:#6b7280;margin-bottom:1rem">${esc(p)}</p>`)
    .join("\n  ");
  return pageMain(`  <h1 style="font-size:2rem;font-weight:700;margin-bottom:1rem">About World Geography Trivia</h1>
  ${paras}
  <p style="margin-top:1rem"><a href="/" style="color:#0e7490">Browse quizzes →</a></p>`);
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

/**
 * Homepage body. `categories` is the flat list of VISIBLE categories (the
 * caller applies draft/ancestor filtering); a root section is rendered for
 * each `parentId === null` entry with its direct children as links.
 */
export function homeBody(categories, courses) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const roots = [];
  const childrenMap = new Map();

  for (const c of categories) {
    if (c.parentId === null) {
      roots.push(c);
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

  return pageMain(`  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Explore the World</h1>
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
  </section>` : ""}`);
}

// ---------------------------------------------------------------------------
// Quiz detail
// ---------------------------------------------------------------------------

// Width list comes from the shared @workspace/image-config module so it stays
// in sync with the generator (artifacts/geo-quiz/optimize-images.mjs) and the
// client component (artifacts/geo-quiz/src/components/ResponsiveImage.tsx). The
// naming convention here must still match those consumers.
const SSR_IMG_WIDTHS = RESPONSIVE_IMAGE_WIDTHS;
const SSR_IMG_OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];

function ssrImgSrcSet(rawPath, format) {
  const dot = rawPath.lastIndexOf(".");
  const stem = rawPath.slice(0, dot);
  return SSR_IMG_WIDTHS.map((w) => `${stem}-${w}.${format} ${w}w`).join(", ");
}

// Renders a question image as a <picture> with AVIF + WebP sources for
// locally-hosted (pre-optimized) images, falling back to a plain <img> for
// external URLs. Mirrors the client ResponsiveImage component.
function questionImageHtml(imageUrl) {
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

/**
 * Quiz landing page body. Pass `questions: []` when questions are not
 * available (the prerender path) — the questions section is omitted entirely.
 */
export function quizBody(quiz) {
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

  return pageMain(`  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
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
  </section>` : ""}`);
}

// ---------------------------------------------------------------------------
// Category detail
// ---------------------------------------------------------------------------

export function categoryBody(category, ancestors, subcategories, quizzes) {
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

  return pageMain(`  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
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
  }`);
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export function coursesBody(courses) {
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
  return pageMain(`  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Geography Courses</h1>
  <p style="color:#6b7280;margin-bottom:1.5rem">Learn geography through structured modules with explanations and fun facts.</p>
  ${items.length ? `<ul style="padding:0;list-style:none;display:flex;flex-direction:column;gap:0.5rem">\n    ${items}\n  </ul>` : ""}`);
}

export function courseDetailBody(course, modules) {
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
  return pageMain(`  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
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
  }`);
}

// ---------------------------------------------------------------------------
// Did You Know
// ---------------------------------------------------------------------------

export function didYouKnowBody(factoids, articles) {
  const factoidItems = factoids
    .map((f) => {
      const src =
        f.sourceUrl && /^https?:\/\//i.test(f.sourceUrl)
          ? ` <a href="${esc(f.sourceUrl)}" rel="noopener noreferrer" style="color:#0e7490;font-size:0.8rem">${esc(f.sourceLabel || "Source")}</a>`
          : f.sourceLabel
            ? ` <span style="color:#9ca3af;font-size:0.8rem">— ${esc(f.sourceLabel)}</span>`
            : "";
      // renderMarkdown HTML-escapes its input and wraps in <p>; strip the
      // wrapping paragraph so the fact stays inline within the <span>.
      const textHtml = renderMarkdown(f.text)
        .replace(/^<p>/, "")
        .replace(/<\/p>\s*$/, "");
      return `<li style="padding:0.75rem 0;border-bottom:1px solid #f3f4f6"><span style="color:#374151">${textHtml}</span>${src}</li>`;
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

  return pageMain(`  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Did You Know?</h1>
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
  }`);
}

// ---------------------------------------------------------------------------
// SEO articles (/articles, /articles/:slug) — static editorial content from
// @workspace/seo-content. Callers pass the article objects through; these
// builders own only the crawler markup.
// ---------------------------------------------------------------------------

/** Strip markdown tokens down to plain text (for JSON-LD fields). */
function mdToPlainText(md) {
  return String(md ?? "")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function seoArticlesIndexBody(articles) {
  const items = articles
    .map(
      (a) =>
        `<li style="padding:0.75rem 0;border-bottom:1px solid #f3f4f6"><a href="/articles/${esc(a.slug)}" style="color:#0e7490;font-weight:600">${esc(a.title)}</a>` +
        ` — <span style="color:#6b7280">${esc(a.cardDescription)}</span>` +
        ` <span style="color:#9ca3af;font-size:0.8rem">(${a.readMinutes} min read)</span></li>`,
    )
    .join("\n      ");
  return pageMain(`  <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">Articles</h1>
  <p style="color:#6b7280;margin-bottom:1.5rem">The geography stories behind the quizzes.</p>
  <ul style="padding:0;list-style:none">
      ${items}
  </ul>`);
}

export function seoArticleBody(article, relatedQuizzes, otherArticles) {
  const faqHtml = article.faqs.length
    ? `<section aria-label="Frequently asked questions">
    <h2 style="font-size:1.25rem;font-weight:700;margin:1.5rem 0 0.5rem">Common Questions</h2>
    ${article.faqs
      .map(
        (f) =>
          `<div style="margin-bottom:0.75rem"><p style="font-weight:700;margin:0 0 0.25rem">${esc(f.question)}</p><p style="color:#6b7280;margin:0">${renderMarkdown(f.answer).replace(/^<p>/, "").replace(/<\/p>\s*$/, "")}</p></div>`,
      )
      .join("\n    ")}
  </section>`
    : "";

  const ctaHtml = `<section aria-label="Related quizzes" style="margin-top:1.5rem">
    <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:0.25rem">${esc(article.cta.heading)}</h2>
    <p style="color:#6b7280;margin:0 0 0.5rem">${esc(article.cta.text)}</p>
    ${article.cta.buttons
      .map(
        (b) =>
          `<p style="margin:0.25rem 0"><a href="${esc(b.href)}" style="color:#0e7490;font-weight:600">${esc(b.label)} →</a></p>`,
      )
      .join("\n    ")}
  </section>`;

  const quizLinks = (relatedQuizzes ?? [])
    .map(
      (q) =>
        `<li style="padding:0.25rem 0"><a href="/quiz/${q.id}" style="color:#0e7490;font-weight:600">${esc(q.title)}</a> <span style="color:#9ca3af;font-size:0.85rem">(${q.questionCount} questions · ${esc(q.difficulty)})</span></li>`,
    )
    .join("\n      ");
  const moreLinks = (otherArticles ?? [])
    .map(
      (a) =>
        `<li style="padding:0.25rem 0"><a href="/articles/${esc(a.slug)}" style="color:#0e7490;font-weight:600">${esc(a.title)}</a></li>`,
    )
    .join("\n      ");

  return pageMain(`  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
    <a href="/" style="color:#0e7490">Home</a> › <a href="/articles" style="color:#0e7490">Articles</a>
  </nav>
  <article>
    <p style="color:#d4570f;font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 0.5rem">${esc(article.tag)}</p>
    <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(article.title)}</h1>
    <p style="color:#9ca3af;font-size:0.875rem;margin:0 0 1.5rem">${esc(article.publishedLabel)} · ${article.readMinutes} min read</p>
    <img src="${esc(article.illustration)}" alt="${esc(article.illustrationAlt)}" style="max-width:100%;height:auto;border-radius:0.75rem;margin-bottom:1.5rem" />
    <div>${renderMarkdown(article.body)}</div>
    ${faqHtml}
    ${ctaHtml}
  </article>
  ${
    quizLinks
      ? `<section aria-label="Test yourself" style="margin-top:2rem">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">Test Yourself</h2>
    <ul style="padding:0;list-style:none">
      ${quizLinks}
    </ul>
  </section>`
      : ""
  }
  ${
    moreLinks
      ? `<section aria-label="More articles" style="margin-top:1.5rem">
    <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">More Articles</h2>
    <ul style="padding:0;list-style:none">
      ${moreLinks}
    </ul>
  </section>`
      : ""
  }`);
}

/**
 * schema.org JSON-LD for a static SEO article: Article + BreadcrumbList, plus
 * FAQPage when the article has FAQ entries (they're written for
 * featured-snippet queries). Shared by prerender and the api-server SSR route
 * so both emit identical structured data.
 */
export function seoArticleJsonLd(article, domain) {
  const url = (p) => (domain ? `${domain}${p}` : p);
  const articleUrl = url(`/articles/${article.slug}`);
  const graph = [
    {
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription,
      url: articleUrl,
      image: url(article.illustration),
      keywords: article.keywords.join(", "),
      datePublished: article.datePublished,
      dateModified: article.datePublished,
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: domain || "/",
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: url("/") },
        { "@type": "ListItem", position: 2, name: "Articles", item: url("/articles") },
        { "@type": "ListItem", position: 3, name: article.title, item: articleUrl },
      ],
    },
  ];
  if (article.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: article.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: mdToPlainText(f.answer) },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function articleDetailBody(article) {
  return pageMain(`  <nav aria-label="Breadcrumb" style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
    <a href="/" style="color:#0e7490">Home</a> › <a href="/did-you-know" style="color:#0e7490">Did You Know</a>
  </nav>
  <article>
    <h1 style="font-size:2rem;font-weight:700;margin-bottom:0.5rem">${esc(article.title)}</h1>
    ${article.summary ? `<p style="color:#6b7280;margin-bottom:1.5rem">${esc(article.summary)}</p>` : ""}
    ${article.imageUrl ? `<img src="${esc(article.imageUrl)}" alt="${esc(article.title)}" style="max-width:100%;height:auto;border-radius:0.5rem;margin-bottom:1.5rem" />` : ""}
    <div>${renderMarkdown(article.body)}</div>
  </article>`);
}
