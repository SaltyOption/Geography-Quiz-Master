// Seed four island-themed quizzes, inspired by the "10 Largest Islands in the
// World" article but deliberately ranging wider than the top-ten list.
//
// Difficulty is meant to be real, not a label. The ladder is:
//   easy   — single-step recall of places most people have heard of
//            (Madagascar's continent, Japan's four main islands)
//   medium — knowledge beyond the famous: who actually administers an island,
//            and which archipelago is where
//   hard   — specialist superlatives and records that reward genuine study
//            (Devon Island, Alert, Manitoulin, Newfoundland's half-hour zone)
//
// Conventions mirror the existing quizzes (see quiz 27, "Islands and Oceans"):
//   - exactly four options per question, correctOption is a 0-based index
//   - a one-sentence explanation and a short funFact on every question
//   - orderIndex is 0-based and dense
//   - no imageUrl: these are text questions, and every DB image URL is checked
//     by the check-db-image-files pre-deploy gate
//   - each quiz joins the "Physical Geography" category, as quizzes 24-27 do
//
// Quizzes are created UNPUBLISHED so they can be reviewed in the admin UI
// before players see them. Flip `published` on there to release them.
//
// Idempotent: quizzes are matched by title, so re-running never duplicates.
// Run against a real database (dev or production) with DATABASE_URL set:
//
//   pnpm --filter @workspace/scripts run seed-island-quizzes

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  quizzesTable,
  questionsTable,
  categoriesTable,
  quizCategoriesTable,
} from "@workspace/db";

type SeedQuestion = {
  text: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
  funFact: string;
};

type SeedQuiz = {
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  categorySlug: string;
  questions: SeedQuestion[];
};

const QUIZZES: SeedQuiz[] = [
  {
    title: "Islands of the World",
    description:
      "Start with the islands everyone has heard of. Where is Madagascar, which country owns Greenland, and what are Japan's four main islands? A gentle tour of the world's most familiar islands.",
    category: "Islands and Oceans",
    difficulty: "easy",
    categorySlug: "physical-geography",
    questions: [
      {
        text: "Madagascar lies off the coast of which continent?",
        options: ["Africa", "South America", "Asia", "Australia"],
        correctOption: 0,
        explanation:
          "Madagascar sits in the Indian Ocean off the southeastern coast of Africa, separated from the mainland by the Mozambique Channel.",
        funFact: "About 90% of Madagascar's wildlife is found nowhere else on Earth.",
      },
      {
        text: "Which country's four main islands are Honshu, Hokkaido, Kyushu, and Shikoku?",
        options: ["South Korea", "Japan", "Philippines", "Indonesia"],
        correctOption: 1,
        explanation:
          "These are the four largest islands of Japan, with Honshu the biggest and home to Tokyo.",
        funFact: "Honshu holds over 100 million people — more than any other island on Earth except Java.",
      },
      {
        text: "Greenland is an autonomous territory of which country?",
        options: ["Norway", "Iceland", "Canada", "Denmark"],
        correctOption: 3,
        explanation:
          "Greenland is a self-governing territory within the Kingdom of Denmark.",
        funFact: "Greenland is roughly 50 times the size of Denmark itself.",
      },
      {
        text: "In which ocean would you find the Maldives?",
        options: ["Pacific Ocean", "Atlantic Ocean", "Arctic Ocean", "Indian Ocean"],
        correctOption: 3,
        explanation:
          "The Maldives is an archipelago in the Indian Ocean, southwest of Sri Lanka and India.",
        funFact: "Around 99% of the Maldives' territory is water rather than land.",
      },
      {
        text: "Bali is an island of which country?",
        options: ["Thailand", "Malaysia", "Indonesia", "Vietnam"],
        correctOption: 2,
        explanation: "Bali is one of Indonesia's many islands, lying just east of Java.",
        funFact: "Indonesia is made up of more than 17,000 islands in total.",
      },
      {
        text: "Which US state is made up entirely of islands?",
        options: ["Hawaii", "Alaska", "Florida", "Rhode Island"],
        correctOption: 0,
        explanation:
          "Hawaii is an archipelago in the central Pacific and the only US state consisting entirely of islands.",
        funFact: "Hawaii is the most isolated major population centre on Earth.",
      },
      {
        text: "Great Britain is made up of England, Wales, and which other country?",
        options: ["Ireland", "Scotland", "Northern Ireland", "Isle of Man"],
        correctOption: 1,
        explanation:
          "Great Britain is the island containing England, Wales, and Scotland — Northern Ireland is on a different island.",
        funFact: "Great Britain is the largest island in Europe.",
      },
      {
        text: "Which island is an Australian state, separated from the mainland by the Bass Strait?",
        options: ["Tasmania", "New Guinea", "Fiji", "Timor"],
        correctOption: 0,
        explanation:
          "Tasmania lies about 240 km south of the Australian mainland across the Bass Strait.",
        funFact: "Tasmania has some of the cleanest air in the world, measured at Cape Grim.",
      },
      {
        text: "Cuba is the largest island in which sea?",
        options: ["Mediterranean Sea", "Caribbean Sea", "Coral Sea", "Baltic Sea"],
        correctOption: 1,
        explanation: "Cuba is the largest island in the Caribbean Sea by both area and population.",
        funFact: "Cuba lies only about 150 km south of Florida.",
      },
      {
        text: "Which island country lies southeast of Australia and is known for the kiwi bird?",
        options: ["Fiji", "Papua New Guinea", "New Zealand", "Vanuatu"],
        correctOption: 2,
        explanation:
          "New Zealand lies roughly 2,000 km southeast of Australia across the Tasman Sea.",
        funFact: "The kiwi is flightless, and New Zealanders are nicknamed Kiwis after it.",
      },
      {
        text: "Fiji, Samoa, and Tonga are islands in which ocean?",
        options: ["Indian Ocean", "Atlantic Ocean", "Southern Ocean", "Pacific Ocean"],
        correctOption: 3,
        explanation: "All three are island nations in the South Pacific Ocean.",
        funFact: "The Pacific covers more area than all of Earth's land combined.",
      },
      {
        text: "Most of Greenland's surface is covered by what?",
        options: ["Dense forest", "A thick ice sheet", "Desert sand", "Grassland"],
        correctOption: 1,
        explanation:
          "About 80% of Greenland lies under an ice sheet up to three kilometres thick.",
        funFact: "It is the largest body of ice on Earth after Antarctica's.",
      },
    ],
  },
  {
    title: "Who Owns This Island?",
    description:
      "Islands rarely belong to the country nearest them. Test whether you can name the flag flying over Svalbard, Socotra, Réunion, and the Canadian Arctic giants.",
    category: "Islands and Oceans",
    difficulty: "medium",
    categorySlug: "physical-geography",
    questions: [
      {
        text: "Baffin Island, Victoria Island, and Ellesmere Island all belong to which country?",
        options: ["Russia", "Norway", "Canada", "Denmark"],
        correctOption: 2,
        explanation:
          "All three are part of the Canadian Arctic Archipelago, and all three rank among the world's ten largest islands.",
        funFact: "Baffin Island is larger than Spain but home to only around 13,000 people.",
      },
      {
        text: "The Svalbard archipelago, high in the Arctic, is under the sovereignty of which country?",
        options: ["Norway", "Russia", "Iceland", "Finland"],
        correctOption: 0,
        explanation:
          "Svalbard is part of Norway, governed under the terms of the 1920 Svalbard Treaty.",
        funFact: "Svalbard houses the Global Seed Vault, a backup of the world's crop seeds.",
      },
      {
        text: "Réunion, in the Indian Ocean, is an overseas department of which country?",
        options: ["Portugal", "France", "Netherlands", "United Kingdom"],
        correctOption: 1,
        explanation:
          "Réunion is a full overseas department of France, which makes it part of the European Union.",
        funFact: "Réunion uses the euro, despite sitting east of Madagascar.",
      },
      {
        text: "The Canary Islands are an autonomous community of which country?",
        options: ["Morocco", "Portugal", "France", "Spain"],
        correctOption: 3,
        explanation:
          "The Canary Islands belong to Spain, though they lie off the northwest coast of Africa.",
        funFact: "Tenerife's Mount Teide is the highest point in all of Spain.",
      },
      {
        text: "The island of Socotra, known for its alien-looking dragon's blood trees, belongs to which country?",
        options: ["Oman", "Somalia", "Eritrea", "Yemen"],
        correctOption: 3,
        explanation:
          "Socotra is part of Yemen, although it lies much closer to the Horn of Africa.",
        funFact: "A third of Socotra's plant species exist nowhere else on Earth.",
      },
      {
        text: "Zanzibar is a semi-autonomous region of which country?",
        options: ["Kenya", "Tanzania", "Mozambique", "Uganda"],
        correctOption: 1,
        explanation:
          "Zanzibar is an archipelago off East Africa that forms part of Tanzania.",
        funFact: "Tanzania's name comes from combining Tanganyika and Zanzibar.",
      },
      {
        text: "The Falkland Islands are an overseas territory of which country?",
        options: ["Argentina", "Chile", "United Kingdom", "Spain"],
        correctOption: 2,
        explanation:
          "The Falkland Islands are a British Overseas Territory in the South Atlantic, though Argentina also claims them.",
        funFact: "Sheep outnumber people on the Falklands by roughly 200 to one.",
      },
      {
        text: "Tierra del Fuego, at South America's southern tip, is divided between Chile and which other country?",
        options: ["Argentina", "Uruguay", "Bolivia", "Peru"],
        correctOption: 0,
        explanation:
          "The archipelago is split between Chile and Argentina, with the border running through the main island.",
        funFact: "Its name means 'Land of Fire', from the campfires early European sailors saw onshore.",
      },
      {
        text: "The Faroe Islands are a self-governing nation within which kingdom?",
        options: ["Norway", "Sweden", "Iceland", "Denmark"],
        correctOption: 3,
        explanation:
          "Like Greenland, the Faroe Islands are a self-governing part of the Kingdom of Denmark.",
        funFact: "The Faroes have their own football team and compete separately from Denmark.",
      },
      {
        text: "Corsica, the birthplace of Napoleon, is a territory of which country?",
        options: ["France", "Italy", "Spain", "Monaco"],
        correctOption: 0,
        explanation:
          "Corsica belongs to France, although it lies closer to Italy and was once Genoese.",
        funFact: "Corsica sits just north of Sardinia, separated by the narrow Strait of Bonifacio.",
      },
      {
        text: "Sardinia, the second-largest island in the Mediterranean, belongs to which country?",
        options: ["Spain", "Greece", "Italy", "Tunisia"],
        correctOption: 2,
        explanation: "Sardinia is an autonomous region of Italy, west of the Italian mainland.",
        funFact: "Sardinia is one of the world's 'Blue Zones', known for exceptional longevity.",
      },
      {
        text: "The island of Sakhalin, lying just north of Japan, belongs to which country?",
        options: ["Japan", "China", "Russia", "South Korea"],
        correctOption: 2,
        explanation:
          "Sakhalin is Russian territory, separated from Hokkaido by the La Pérouse Strait.",
        funFact: "Sakhalin was divided between Russia and Japan for much of the 20th century.",
      },
    ],
  },
  {
    title: "Archipelagos and Island Chains",
    description:
      "Some countries are scattered across thousands of islands. From the Galápagos to the Aleutians, the Azores to the Andamans — can you place the world's great island chains?",
    category: "Islands and Oceans",
    difficulty: "medium",
    categorySlug: "physical-geography",
    questions: [
      {
        text: "The Galápagos Islands, which helped inspire Darwin's theory of evolution, belong to which country?",
        options: ["Peru", "Colombia", "Chile", "Ecuador"],
        correctOption: 3,
        explanation:
          "The Galápagos are a province of Ecuador, roughly 900 km off its Pacific coast.",
        funFact: "Galápagos giant tortoises can live for well over 100 years.",
      },
      {
        text: "Which island nation between Sicily and North Africa is the smallest member state of the European Union?",
        options: ["Cyprus", "Malta", "Monaco", "San Marino"],
        correctOption: 1,
        explanation:
          "Malta is an archipelago in the central Mediterranean and the smallest country in the EU.",
        funFact: "Its capital, Valletta, covers less than one square kilometre.",
      },
      {
        text: "The Aleutian Islands stretch west into the Pacific from which US state?",
        options: ["Alaska", "Hawaii", "Washington", "Oregon"],
        correctOption: 0,
        explanation:
          "The Aleutians extend roughly 1,900 km southwest from the Alaskan mainland.",
        funFact: "The chain crosses the 180th meridian, putting part of Alaska in the Eastern Hemisphere.",
      },
      {
        text: "The Azores are an autonomous region of which country?",
        options: ["Spain", "Morocco", "Italy", "Portugal"],
        correctOption: 3,
        explanation:
          "The Azores are a Portuguese archipelago in the middle of the North Atlantic.",
        funFact: "They sit atop the Mid-Atlantic Ridge, where three tectonic plates meet.",
      },
      {
        text: "Which Indian Ocean nation is made up of roughly 1,200 coral islands grouped into 26 atolls?",
        options: ["Seychelles", "Mauritius", "Maldives", "Comoros"],
        correctOption: 2,
        explanation:
          "The Maldives consists of nearly 1,200 coral islands spread across the Indian Ocean.",
        funFact: "It is the flattest country on Earth, with a natural high point under 2.5 metres.",
      },
      {
        text: "The Hebrides lie off the west coast of which country?",
        options: ["Ireland", "Norway", "Iceland", "Scotland"],
        correctOption: 3,
        explanation:
          "The Inner and Outer Hebrides are island groups off Scotland's western coast.",
        funFact: "Scotland has around 900 offshore islands in total.",
      },
      {
        text: "The Åland Islands, an autonomous, Swedish-speaking archipelago in the Baltic Sea, belong to which country?",
        options: ["Sweden", "Estonia", "Finland", "Denmark"],
        correctOption: 2,
        explanation:
          "Åland is an autonomous region of Finland, though its official language is Swedish.",
        funFact: "Åland is demilitarised under an international treaty dating back to 1856.",
      },
      {
        text: "The Balearic Islands, including Mallorca and Ibiza, belong to which country?",
        options: ["France", "Italy", "Spain", "Greece"],
        correctOption: 2,
        explanation:
          "The Balearics are an autonomous community of Spain in the western Mediterranean.",
        funFact: "Mallorca is the largest island in the group by some margin.",
      },
      {
        text: "The Cyclades and the Dodecanese are island groups belonging to which country?",
        options: ["Turkey", "Greece", "Italy", "Cyprus"],
        correctOption: 1,
        explanation: "Both are Greek island groups in the Aegean Sea.",
        funFact: "Greece has thousands of islands, but only around 200 are inhabited.",
      },
      {
        text: "Which island country lies about 570 km off West Africa and consists of ten volcanic islands?",
        options: ["Cape Verde", "São Tomé and Príncipe", "Canary Islands", "Madeira"],
        correctOption: 0,
        explanation:
          "Cape Verde is an independent archipelago nation in the Atlantic, west of Senegal.",
        funFact: "Cape Verde made its World Cup debut at the 2026 tournament.",
      },
      {
        text: "The Andaman and Nicobar Islands are a territory of which country?",
        options: ["Indonesia", "Thailand", "Myanmar", "India"],
        correctOption: 3,
        explanation:
          "The Andaman and Nicobar Islands are an Indian union territory in the Bay of Bengal.",
        funFact: "They lie closer to Myanmar and Indonesia than to the Indian mainland.",
      },
      {
        text: "The Lofoten Islands, famous for their dramatic peaks above the Arctic Circle, lie off which country?",
        options: ["Iceland", "Norway", "Scotland", "Greenland"],
        correctOption: 1,
        explanation: "Lofoten is an archipelago off the northwestern coast of Norway.",
        funFact: "Despite being inside the Arctic Circle, Lofoten is mild for its latitude thanks to the Gulf Stream.",
      },
    ],
  },
  {
    title: "Island Extremes",
    description:
      "The records, superlatives, and outright oddities of island geography — from the largest uninhabited island to a half-hour time zone and an island inside a lake inside an island. For serious island geographers only.",
    category: "Islands and Oceans",
    difficulty: "hard",
    categorySlug: "physical-geography",
    questions: [
      {
        text: "Which is the largest uninhabited island in the world, used by scientists as a stand-in for Mars?",
        options: ["Devon Island", "Wrangel Island", "Baffin Island", "Bouvet Island"],
        correctOption: 0,
        explanation:
          "Devon Island in the Canadian Arctic is the largest uninhabited island on Earth, and its barren terrain is used to rehearse Mars missions.",
        funFact: "Its Haughton crater was formed by a meteorite impact some 39 million years ago.",
      },
      {
        text: "Manitoulin Island in Lake Huron holds which world record?",
        options: [
          "Largest island in a freshwater lake",
          "Largest island in the Arctic",
          "Most remote inhabited island",
          "Largest volcanic island",
        ],
        correctOption: 0,
        explanation:
          "Manitoulin is the largest island located within a freshwater lake anywhere in the world.",
        funFact: "Manitoulin has lakes of its own — and those lakes contain their own islands.",
      },
      {
        text: "Puncak Jaya, the highest peak on any island in the world, rises on which island?",
        options: ["Borneo", "Honshu", "Sumatra", "New Guinea"],
        correctOption: 3,
        explanation:
          "Puncak Jaya reaches about 4,884 metres on New Guinea, the highest summit of any island.",
        funFact: "Despite sitting near the equator, it hosts some of the world's only tropical glaciers.",
      },
      {
        text: "Alert, the northernmost permanently inhabited place on Earth, sits on which island?",
        options: ["Baffin Island", "Ellesmere Island", "Svalbard", "Greenland"],
        correctOption: 1,
        explanation:
          "Alert lies on Ellesmere Island in the Canadian Arctic, within about 800 km of the North Pole.",
        funFact: "Fewer than 200 people live on Ellesmere, an island bigger than half of Germany.",
      },
      {
        text: "Which island nation earns significant national revenue by licensing its .tv internet domain?",
        options: ["Nauru", "Tonga", "Tuvalu", "Kiribati"],
        correctOption: 2,
        explanation:
          "Tuvalu's country code happens to be .tv, and licensing it to broadcasters has earned the country millions.",
        funFact: "Tuvalu's highest point is only about 4.6 metres above sea level.",
      },
      {
        text: "Which island nation consists of 29 coral atolls and includes Bikini Atoll?",
        options: ["Marshall Islands", "Micronesia", "Palau", "Solomon Islands"],
        correctOption: 0,
        explanation:
          "The Marshall Islands is made up of 29 atolls in the central Pacific, among them Bikini Atoll.",
        funFact: "Its land area is tiny, but its ocean territory spans nearly 2 million square kilometres.",
      },
      {
        text: "Newfoundland is known for keeping which unusual time zone?",
        options: ["UTC−4:00", "UTC−3:30", "UTC−5:30", "UTC−2:45"],
        correctOption: 1,
        explanation:
          "Newfoundland runs on UTC−3:30, one of the few half-hour offset zones in the Americas.",
        funFact: "Newfoundland was an independent dominion and only joined Canada in 1949.",
      },
      {
        text: "L'Anse aux Meadows, the only confirmed Norse settlement in North America, is on which island?",
        options: ["Greenland", "Baffin Island", "Newfoundland", "Iceland"],
        correctOption: 2,
        explanation:
          "L'Anse aux Meadows sits on the northern tip of Newfoundland and dates to around 1000 AD.",
        funFact: "It proves Europeans reached the Americas roughly 500 years before Columbus.",
      },
      {
        text: "Which island's interior was stripped down to jagged limestone pinnacles by decades of phosphate mining?",
        options: ["Nauru", "Tuvalu", "Niue", "Banaba"],
        correctOption: 0,
        explanation:
          "Phosphate mining made Nauru briefly wealthy but left much of the island's interior uninhabitable.",
        funFact: "Nauru is the world's smallest republic and the only country with no official capital.",
      },
      {
        text: "Which country is the flattest in the world, with a natural high point under 2.5 metres?",
        options: ["Tuvalu", "Kiribati", "Marshall Islands", "Maldives"],
        correctOption: 3,
        explanation:
          "The Maldives has the lowest maximum elevation of any country on Earth.",
        funFact: "It is also the smallest country in Asia by both land area and population.",
      },
      {
        text: "Which island contains the world's largest island-in-a-lake-on-an-island?",
        options: ["Baffin Island", "Victoria Island", "Southampton Island", "Devon Island"],
        correctOption: 1,
        explanation:
          "Victoria Island in the Canadian Arctic holds the largest known island within a lake on an island.",
        funFact: "Victoria Island is nearly the size of Great Britain but home to only about 2,000 people.",
      },
      {
        text: "Which island is the only place on Earth where tigers, elephants, rhinos, and orangutans share the same forests?",
        options: ["Borneo", "Java", "Sumatra", "Sulawesi"],
        correctOption: 2,
        explanation:
          "Sumatra is the only island where all four of these species coexist in the wild — and all four are critically endangered there.",
        funFact: "Sumatra sits on the Ring of Fire, along the fault that caused the 2004 tsunami.",
      },
    ],
  },
];

async function seedQuizzes(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const quiz of QUIZZES) {
    const existing = await db
      .select()
      .from(quizzesTable)
      .where(eq(quizzesTable.title, quiz.title));
    if (existing.length > 0) {
      console.log(`  skip   "${quiz.title}" — already present (id ${existing[0].id})`);
      skipped++;
      continue;
    }

    const [row] = await db
      .insert(quizzesTable)
      .values({
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        difficulty: quiz.difficulty,
        // Created unpublished on purpose: review in the admin UI, then release.
        published: false,
      })
      .returning({ id: quizzesTable.id });

    await db.insert(questionsTable).values(
      quiz.questions.map((q, i) => ({
        quizId: row.id,
        text: q.text,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        funFact: q.funFact,
        orderIndex: i,
      })),
    );

    // Attach the quiz to its browse category, as quizzes 24-27 are.
    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, quiz.categorySlug));
    if (category) {
      await db
        .insert(quizCategoriesTable)
        .values({ quizId: row.id, categoryId: category.id });
    } else {
      console.warn(
        `  warn   category "${quiz.categorySlug}" not found — "${quiz.title}" left uncategorised`,
      );
    }

    console.log(
      `  create "${quiz.title}" (id ${row.id}, ${quiz.difficulty}, ${quiz.questions.length} questions, unpublished)`,
    );
    created++;
  }

  return { created, skipped };
}

function validate(): void {
  const problems: string[] = [];

  for (const quiz of QUIZZES) {
    if (quiz.questions.length !== 12) {
      problems.push(`${quiz.title}: expected 12 questions, found ${quiz.questions.length}`);
    }
    const seen = new Set<string>();
    for (const q of quiz.questions) {
      if (q.options.length !== 4) {
        problems.push(`${quiz.title}: "${q.text}" has ${q.options.length} options, expected 4`);
      }
      if (new Set(q.options).size !== q.options.length) {
        problems.push(`${quiz.title}: "${q.text}" has duplicate options`);
      }
      if (q.correctOption < 0 || q.correctOption >= q.options.length) {
        problems.push(`${quiz.title}: "${q.text}" correctOption out of range`);
      }
      if (seen.has(q.text)) {
        problems.push(`${quiz.title}: duplicate question "${q.text}"`);
      }
      seen.add(q.text);
    }
  }

  if (problems.length > 0) {
    throw new Error("Seed data invalid:\n  - " + problems.join("\n  - "));
  }
}

async function main(): Promise<void> {
  validate();

  // Answer positions should not be guessable — report the spread.
  const spread = [0, 0, 0, 0];
  for (const quiz of QUIZZES) {
    for (const q of quiz.questions) spread[q.correctOption]++;
  }
  console.log(`Answer position spread (A/B/C/D): ${spread.join(" / ")}`);

  const { created, skipped } = await seedQuizzes();
  console.log(
    `\nQuizzes: ${created} created, ${skipped} already present. ` +
      (created > 0
        ? "New quizzes are UNPUBLISHED — publish them from the admin UI when ready."
        : ""),
  );
}

main()
  .catch((err) => {
    console.error("seed-island-quizzes failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
