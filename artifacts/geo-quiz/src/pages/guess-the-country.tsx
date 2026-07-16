import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import AtlasGame from "@/features/atlas/game/App";
import "@/features/atlas/atlas.css";

/**
 * "Where's Atlas?" — the daily country-guessing game, ported in from its former
 * standalone deploy. The game is vendored, self-contained React under
 * `@/features/atlas/game`; here we just give it its dark full-bleed section and
 * the page's SEO metadata. The site navbar and footer wrap it via App.tsx.
 */
export default function GuessTheCountryPage() {
  usePageMeta({
    title: "Where's Atlas? — Daily Country Guessing Game",
    description:
      "Atlas the swallow has flown to a mystery country. Guess it in 6 tries using capital-to-capital distance and direction hints — a new puzzle every day.",
    canonical: canonicalOrigin() + "/guess-the-country",
  });

  return (
    <div className="atlas-game">
      <AtlasGame />
    </div>
  );
}
