# Article drafts

Drop new SEO articles here as `<slug>.md` — one file per article, named for the URL
you want. `smallest-country-in-the-world.md` becomes `/articles/smallest-country-in-the-world`.

Copy `_TEMPLATE.md` to start. Fill in the frontmatter, write the body in markdown,
then say the word and the draft gets converted into `lib/seo-content/src/articles.js`,
which is what the site actually renders.

## What happens after you save one

A draft in this folder is not live. Publishing it means:

1. Converting the draft into an entry in `lib/seo-content/src/articles.js`.
2. Adding an illustration SVG to `artifacts/geo-quiz/public/articles/`.
3. Committing and deploying.

From there the article renders at `/articles/<slug>`, appears on the homepage and
the `/articles` index, gets a server-rendered `<meta>` description for crawlers,
and is added to the sitemap — all driven off that one entry.

Once an article is live, `articles.js` is the source of truth. Copy fixes go there
directly, not here — the draft in this folder is just the intake format and is not
re-read after conversion.

## Notes on the fields

Most of the frontmatter is self-explanatory; these are the ones with constraints:

- **`metaDescription`** — aim for 150–160 characters. This is the Google snippet.
- **`tag`** — a short editorial category shown as a pill above the title, e.g.
  "Size & Scale", "Borders & Territory". Reuse an existing one where it fits.
- **`cardDescription`** — one sentence, shown on the homepage and article index cards.
  Should stand alone without the title.
- **`illustration`** — path under `/articles/`. If the SVG doesn't exist yet, name it
  anyway and flag it; the article can't ship without one.
- **`relatedQuizIds`** — real quiz IDs, shown in the sidebar. These and the CTA
  buttons are the article→quiz mechanic, so pick quizzes that genuinely follow from
  the piece. Leave empty if unsure and they'll get filled in during conversion.
- **`readMinutes`** — a rough estimate; ~200 words per minute is the convention here.
- **`faqs`** — optional but valuable: they render as cards and emit FAQPage
  structured data, which is what wins the expandable Google results.

## Body conventions

Follow the existing six articles. Open with a direct answer to the title question in
the first paragraph — it renders larger than the rest and is what Google tends to
lift. Use `##` for sections, bold for the terms a reader is skimming for, and tables
for anything enumerable. No `#` H1 in the body; the title field provides it.
