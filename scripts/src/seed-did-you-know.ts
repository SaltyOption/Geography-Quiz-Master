// Seed starter "Did You Know" content (factoids + articles) so the public
// /did-you-know page isn't empty on day one.
//
// This mirrors how the API would create the same rows:
//   - factoid source URLs must be http(s) (validated with isSafeHttpUrl, the
//     same policy the POST /api/factoids handler enforces)
//   - article slugs are unique
//   - article cover images point at locally hosted landmark photos that exist
//     in artifacts/geo-quiz/public/landmarks
//
// It is idempotent: factoids are matched by their text and articles by their
// slug, so re-running never creates duplicates. Run it against a real database
// (dev or production) with DATABASE_URL set:
//
//   pnpm --filter @workspace/scripts run seed-did-you-know

import { eq } from "drizzle-orm";
import { db, pool, factoidsTable, articlesTable } from "@workspace/db";
import { isSafeHttpUrl } from "@workspace/markdown";

type SeedFactoid = {
  text: string;
  sourceLabel: string;
  sourceUrl: string;
};

type SeedArticle = {
  title: string;
  slug: string;
  summary: string;
  imageUrl: string;
  body: string;
};

const FACTOIDS: SeedFactoid[] = [
  {
    text: "Russia is the largest country on Earth, spanning 11 time zones and covering more than 17 million square kilometres — roughly an eighth of all the inhabited land on the planet.",
    sourceLabel: "Britannica — Russia",
    sourceUrl: "https://www.britannica.com/place/Russia",
  },
  {
    text: "The Nile and the Amazon have long competed for the title of the world's longest river. The Nile is conventionally measured at about 6,650 km, while some surveys put the Amazon slightly longer depending on where its source is placed.",
    sourceLabel: "Britannica — Nile River",
    sourceUrl: "https://www.britannica.com/place/Nile-River",
  },
  {
    text: "Mount Everest, on the border of Nepal and China, is the highest point above sea level at 8,849 metres — and it is still rising a few millimetres each year as the Indian and Eurasian tectonic plates collide.",
    sourceLabel: "Britannica — Mount Everest",
    sourceUrl: "https://www.britannica.com/place/Mount-Everest",
  },
  {
    text: "Vatican City is the smallest country in the world, with an area of just 0.44 square kilometres and a population of around 800 — small enough to fit inside many city parks.",
    sourceLabel: "Britannica — Vatican City",
    sourceUrl: "https://www.britannica.com/place/Vatican-City",
  },
  {
    text: "The Sahara is the largest hot desert on Earth at about 9.2 million square kilometres — nearly the size of the entire United States — and it stretches across 11 African countries.",
    sourceLabel: "Britannica — Sahara",
    sourceUrl: "https://www.britannica.com/place/Sahara-desert-Africa",
  },
  {
    text: "Canada has the longest coastline of any country, totalling roughly 202,000 km — so long that you could circle the equator more than five times along it.",
    sourceLabel: "The World Factbook — Coastline",
    sourceUrl: "https://www.cia.gov/the-world-factbook/field/coastline/",
  },
  {
    text: "The Pacific Ocean is the largest and deepest ocean, and its Mariana Trench plunges to about 11,000 metres — deep enough to swallow Mount Everest with more than two kilometres to spare.",
    sourceLabel: "Britannica — Mariana Trench",
    sourceUrl: "https://www.britannica.com/place/Mariana-Trench",
  },
  {
    text: "Indonesia is the world's largest archipelago, made up of more than 17,000 islands strung along the equator between the Indian and Pacific Oceans.",
    sourceLabel: "Britannica — Indonesia",
    sourceUrl: "https://www.britannica.com/place/Indonesia",
  },
];

const ARTICLES: SeedArticle[] = [
  {
    title: "Why Are There Seven Continents?",
    slug: "why-seven-continents",
    summary:
      "The number of continents seems like settled fact, but where we draw the lines is more a matter of culture and history than pure geology.",
    imageUrl: "/landmarks/great-wall.jpg",
    body: `Ask a class of schoolchildren how many continents there are and the answer you get depends on where the school is. In English-speaking countries, the standard answer is **seven**: Africa, Antarctica, Asia, Australia, Europe, North America, and South America. In much of Europe and Latin America, students learn there are **six** — because the Americas are often counted as one. Some geologists prefer **six** as well, but combine Europe and Asia into a single landmass called *Eurasia*.

## A line drawn by people, not plates

The clearest example is the boundary between Europe and Asia. There is no ocean separating them — the two share one enormous continuous landmass. The dividing line is a convention, usually traced along the Ural Mountains, the Ural River, the Caspian Sea, and the Caucasus. That line exists for historical and cultural reasons far more than geological ones.

This is why the "continent" is a slippery idea. Geologically, a continent is a large block of continental crust. Culturally, it is a way of organising the world into familiar regions. The two definitions don't always agree.

## What counts as a continent?

Geographers tend to look for a few features:

- A large, continuous area of land
- A distinct block of continental crust
- A degree of separation from other landmasses
- Often, a recognisable cultural or historical identity

By those measures, Antarctica is unambiguously a continent — it is a vast landmass on its own tectonic plate. Australia qualifies as the smallest continent (and the largest island, depending on how you frame it). But the Europe–Asia split fails the "separation" test entirely, which is exactly why different traditions count differently.

## Could the number change?

Geology never really stops. The plates that carry the continents are still drifting a few centimetres a year — about as fast as your fingernails grow. Over tens of millions of years, today's continents will rearrange themselves, just as they once joined together in the supercontinent **Pangaea** some 300 million years ago and later broke apart.

So the next time someone tells you there are exactly seven continents, you can tell them the truth: it is one of the most reasonable answers, but it is a human decision dressed up as a fact of nature.`,
  },
];

async function seedFactoids(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const f of FACTOIDS) {
    const text = f.text.trim();
    if (!text) continue;

    if (!isSafeHttpUrl(f.sourceUrl)) {
      throw new Error(`Refusing to seed factoid with unsafe source URL: ${f.sourceUrl}`);
    }

    const existing = await db
      .select()
      .from(factoidsTable)
      .where(eq(factoidsTable.text, text));
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(factoidsTable).values({
      text,
      sourceLabel: f.sourceLabel,
      sourceUrl: f.sourceUrl,
      published: true,
    });
    created++;
  }

  return { created, skipped };
}

async function seedArticles(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const a of ARTICLES) {
    const slug = a.slug;

    const existing = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.slug, slug));
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(articlesTable).values({
      title: a.title.trim(),
      slug,
      summary: a.summary,
      body: a.body,
      imageUrl: a.imageUrl,
      published: true,
    });
    created++;
  }

  return { created, skipped };
}

async function main(): Promise<void> {
  const factoids = await seedFactoids();
  const articles = await seedArticles();

  console.log(
    `Factoids: ${factoids.created} created, ${factoids.skipped} already present.`,
  );
  console.log(
    `Articles: ${articles.created} created, ${articles.skipped} already present.`,
  );
  console.log("Did You Know seed complete.");
}

main()
  .catch((err) => {
    console.error("seed-did-you-know failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
