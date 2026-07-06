# Handoff: Homepage Redesign + Articles Section

## Overview
A redesign of the worldgeographytrivia.com homepage plus a new Articles feature: an article index section on the homepage and a full article page template, with six SEO articles ready to publish and five custom SVG illustrations matching the site's existing flat illustration style.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Your task is to **recreate these designs in the site's existing codebase** using its established patterns, templates, and CMS. Open `Homepage Revised.dc.html` and `Article Page.dc.html` in a browser to see them rendered (keep `support.js` and the `.svg` files alongside them). The `articles/*.md` files ARE production content — publish their text as-is (each includes a suggested URL slug, meta description, and target keywords at the top).

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final intent. Recreate pixel-perfectly, except: match fonts/colors to the site's existing tokens where they already exist (the palette below was derived from the live site).

## Design Tokens
- Background: `#f6f3ee` (page), `#fbf9f6` (nav)
- Card surface: `#fff`, border `#e8e2d8`, radius `16px`
- Navy (primary/buttons/headings accent): `#24407c`
- Orange (accent): `#d4570f`; soft orange `#e8955c`
- Hero/CTA gradient: `linear-gradient(135deg,#fdf0e4,#f9e7dd)`
- Muted text: `#5a6175` / `#6b7183`; meta text `#8a8fa0` / `#8a8271`
- Tan/cream illustration palette: `#f6ead6`, `#e8d5bb`, `#d9bf98`
- Type: display serif = Source Serif 4 (700); UI/body = Figtree (400–700). If the live site uses different fonts, keep the live site's fonts.
- Buttons: pill (`border-radius:999px`), 10px 22px padding, 14px/600
- Card hover: `translateY(-2px)` + `0 8px 24px rgba(36,64,124,.1)` shadow, 150ms

## Screens / Views

### 1. Homepage (`Homepage Revised.dc.html`)
Max-width 1180px, 32px side padding. Section order:
1. **Nav** — logo + wordmark left; Quizzes / Courses / Daily Quiz / Sign In links + single "Sign Up Free" pill right. (Consolidates the current three account CTAs into one; remove the announcement banner.)
2. **Hero** — cream gradient panel, 24px radius. Left: kicker badge, 56px serif "Explore the World" (orange "World"), one-line subtitle, two CTAs ("Play today's quiz" primary, "Browse all quizzes" ghost). Right: mascot illustration. Bottom: 43 / 25 / 7 stat row above a 1px `#ecd9c9` rule.
3. **World Cup 2026** — ONE consolidated card replacing the four "Part X of 4" cards: difficulty pill + "4 parts · 48 questions" meta, title, one-sentence description, progress bar (fill = parts complete / 4), four numbered step circles (completed = navy fill), "Continue →" button. Section header has a one-line timely intro.
4. **By Topic** — 4-up card grid (image 140px tall, object-fit cover; title; ONE real descriptive sentence — no "A quiz on X" filler; quiz-count meta). Header row: serif title + count subtitle left, "View all N →" link right. Same pattern for **By Region**.
5. **Learning Courses** — 3-up grid, same card anatomy plus a navy "7 modules" chip. Courses get imagery like everything else.
6. **Articles** — 3×2 card grid, same card anatomy: illustration (130px), title, one-line description, "N min read" meta. Cards link to article pages.
7. **Footer** — single row: copyright left, links right.

### 2. Article Page (`Article Page.dc.html`)
1. **Breadcrumb** — Home / Articles / <title>.
2. **Header** — orange category tag chip, 44px serif H1 (max-width 820px), "Month Year · N min read" meta, full-width hero illustration (340px, 20px radius).
3. **Two-column body** — `grid-template-columns: 1fr 300px; gap: 56px`.
   - **Article prose**: 17px/1.72 body, 20px lede paragraph, 28px serif H2s, styled data tables (navy header row, white body, 12px radius), FAQ blocks as white cards (bold question, muted answer).
   - **Sticky sidebar**: "Test yourself" box — 3 related quizzes (name, question count, difficulty pill) chosen per article; "More articles" box — text links to the other articles. Sidebar boxes: white, 16px radius, small-caps 11px headers.
4. **Quiz CTA band** — cream gradient panel at article end: serif heading, one line of copy, primary + ghost buttons linking to the two most relevant quizzes. **This article→quiz cross-link is the core growth mechanic — every article must end with one.**
5. Nav + footer identical to homepage ("Articles" nav item active in orange).

## Interactions & Behavior
- Card hover: lift + shadow (see tokens). Whole card is the link.
- Sidebar is `position: sticky; top: 24px`.
- Article pages should render the markdown files' internal links (e.g. `[Countries of the World quiz](/quizzes)`) as links to the real quiz URLs — replace `/quizzes` placeholders with actual routes.
- Mobile (not mocked, use judgment): grids collapse 4→2→1 and 3→1; sidebar moves below the article; hero stacks. Remove `maximum-scale=1` from the site's viewport meta (accessibility).

## SEO / Content Notes
- Each `articles/*.md` file starts with: suggested URL slug, meta description, target keywords. Use them for the page `<title>`/meta.
- Consider FAQ structured data (schema.org FAQPage) for the FAQ sections — the articles are written for featured-snippet queries.
- Read time: word count / 220, rounded.

## Assets (`illustrations/`)
Five original flat-style SVG illustrations (800×450 viewBox, scale to any size, `object-fit: cover` for crops):
- `vatican-illustration.svg` — Smallest Country article
- `istanbul-illustration.svg` — Istanbul article
- `uk-gb-england-illustration.svg` — UK vs GB vs England article
- `multiple-capitals-illustration.svg` — Multiple Capitals article
- `worldcup-host-cities-illustration.svg` — Host Cities article
- `worldcup-teams-illustration.svg` — Teams Map Guide article (globe + pennants)

Palette matches the site's existing illustrations. The homepage mock uses drag-and-drop placeholders (`<image-slot>`) for the site's EXISTING art (mascot, category illustrations, logo) — use the real assets from the live site for those; the image-slot component itself is prototype scaffolding, do not port it.

## Files
- `Homepage Revised.dc.html` — homepage design reference
- `Article Page.dc.html` — article template reference (rendered with the Smallest Country article)
- `support.js`, `image-slot.js` — prototype runtime only; needed to open the references in a browser, NOT for production
- `illustrations/*.svg` — production-ready article art
- `articles/*.md` — production-ready article content (6 articles)
