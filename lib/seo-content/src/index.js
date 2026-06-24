/**
 * Curated SEO meta descriptions, keyed by full route pathname.
 *
 * Shared by every rendering path so the <meta name="description">,
 * og:description and twitter:description stay identical across:
 *   - the prerender script (artifacts/geo-quiz/prerender.mjs)
 *   - server-side rendering (artifacts/api-server ssrTemplate)
 *   - the client meta hook (artifacts/geo-quiz usePageMeta)
 *
 * A path present here overrides the data/template-generated description.
 * Paths absent here fall back to each consumer's existing logic.
 */
export const META_DESCRIPTIONS = {
  "/":
    "Test your world geography knowledge with free quizzes on capitals, countries, landmarks, and regions. Play the daily quiz or start a learning course today.",
  "/daily":
    "A new world geography quiz every day. Test yourself on capitals, countries, landmarks, and regions — and see how you improve over time. Free to play.",
  "/courses":
    "Learn world geography through structured courses on oceans, rivers, deserts, mountains, rainforests, and more. Each course builds knowledge module by module.",
  "/did-you-know":
    "Surprising geography facts and in-depth articles about countries, capitals, landmarks, and the natural world. Discover something new on World Geography Trivia.",

  "/category/europe":
    "Think you know Europe? Test your knowledge of European countries, rivers, mountains, and borders with geography quizzes on World Geography Trivia.",
  "/category/africa":
    "Explore Africa with 3 geography quizzes covering African nations, cities, and physical geography. From easy overviews to challenging deep dives.",
  "/category/middle-east":
    "How well do you know the Middle East? Test your knowledge of ancient sites, countries, and landmarks across the region with this challenging geography quiz.",
  "/category/east-asia":
    "Quiz yourself on East Asia with 2 geography quizzes — an essentials quiz for beginners and a hard deep dive for experts. Countries, cities, and more.",
  "/category/oceania":
    "Explore Oceania with 2 geography quizzes — a beginner-friendly overview and a challenging deep dive covering Australia, New Zealand, and Pacific islands.",
  "/category/north-america":
    "Test your North America geography knowledge with 2 quizzes — from an easy basics quiz to a hard deep dive on countries, capitals, and landscapes.",
  "/category/central-america":
    "How much do you know about Central America? Take a crash course quiz or a hard deep dive covering countries, capitals, and geography across the region.",
  "/category/south-america":
    "Test your South America geography with 2 quizzes — from a medium showcase of countries and capitals to a hard deep dive on rivers, borders, and landmarks.",
  "/category/caribbean":
    "Think you know the Caribbean? Take a quick easy quiz or challenge yourself with our hard deep dive covering islands, capitals, and regional geography.",
  "/category/south-asia":
    "Explore Southeast Asia with 2 geography quizzes — a medium adventure quiz and a hard deep dive on countries, capitals, rivers, and regional geography.",
  "/category/antarctica":
    "How much do you know about Antarctica? Test your knowledge of the world's southernmost continent — its geography, research stations, and extreme environment.",
  "/category/asia":
    "Quiz yourself on Asia's vast geography — countries, capitals, mountain ranges, rivers, and more. Explore the world's largest continent one question at a time.",
  "/category/capitals":
    "How many world capitals do you know? Take our world capitals geography quiz and test your knowledge of capital cities across every continent.",
  "/category/physical-geography":
    "5 quizzes on physical geography — rivers, lakes, islands, oceans, country borders, and outlines. Test your knowledge of the natural world from easy to hard.",
  "/category/ancient-sites":
    "Test your knowledge of the world's ancient sites with a hard geography quiz focused on the Middle East — ruins, temples, and landmarks of the ancient world.",
  "/category/flags":
    "Can you name that flag? Test your world flag knowledge with our geography quiz featuring flags from countries across every continent. How many can you identify?",
  "/category/countries":
    "Country geography quizzes coming soon. Explore related topics like Capitals, Flags, and Physical Geography on World Geography Trivia while you wait.",
  "/category/lakes-and-rivers":
    "Lakes and rivers quizzes coming soon to World Geography Trivia. In the meantime, explore Physical Geography quizzes covering rivers, lakes, and more.",
  "/category/landmarks":
    "How well do you know the world's famous landmarks? Take our easy geography quiz on iconic sites and monuments from around the globe. Free to play.",
  "/category/oceans-and-seas":
    "Test your knowledge of the world's oceans, seas, gulfs, and straits with an easy geography quiz. Perfect for beginners and students studying physical geography.",
  "/category/climate-and-biomes":
    "Climate and biomes quizzes coming soon. Explore related learning courses on tropical rainforests, temperate forests, and the taiga on World Geography Trivia.",
  "/category/population-and-cities":
    "Population and cities geography quizzes coming soon. Explore related quizzes on world capitals and African cities on World Geography Trivia in the meantime.",
  "/category/map-skills-and-coordinates":
    "Test your map reading skills and knowledge of coordinates with geography quizzes on World Geography Trivia. Great for students and geography enthusiasts.",
  "/category/regional-geography":
    "Explore regional geography quizzes covering landscapes, borders, and human geography across the world's major regions on World Geography Trivia.",
  "/category/world-cup-2026":
    "How well do you know the World Cup 2026 team flags? Test yourself with 4 flag identification quizzes covering all 48 nations competing in the tournament.",

  "/courses/oceans-and-seas":
    "Learn about the world's oceans, seas, currents, and marine ecosystems with this structured geography course covering 7 modules from foundations to ocean change.",
  "/courses/rivers-and-lakes":
    "Explore the world's major rivers and lakes with this structured geography course. Learn about watersheds, drainage basins, freshwater ecosystems, and more.",
  "/courses/world-deserts":
    "Discover the world's deserts — from the Sahara to the Atacama — with this structured geography course covering desert formation, climate, and ecosystems.",
  "/courses/mountains-alpine":
    "Learn about the world's great mountain ranges and alpine environments with this structured geography course covering formation, climate zones, and key peaks.",
  "/courses/tropical-rainforest":
    "Explore tropical rainforest ecosystems with this structured geography course. Learn about biodiversity, climate, canopy layers, and regions like the Amazon basin.",
  "/courses/temperate-forest":
    "Discover temperate forest ecosystems around the world with this structured geography course — covering tree species, climate zones, seasonal change, and regions.",
  "/courses/boreal-forest-taiga":
    "Learn about the boreal forest and taiga — Earth's largest land biome — with this structured geography course on climate, wildlife, and the world's northern forests.",
};

/**
 * Look up the curated meta description for a route pathname.
 * Strips query/hash and a trailing slash (except root) before lookup.
 * Returns undefined when no override exists for the path.
 *
 * @param {string | null | undefined} path
 * @returns {string | undefined}
 */
export function getMetaDescription(path) {
  if (!path) return undefined;
  let p = path.split("?")[0].split("#")[0];
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return META_DESCRIPTIONS[p];
}
