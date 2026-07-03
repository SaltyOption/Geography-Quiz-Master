import { Link } from "wouter";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { Globe, Compass, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Single source of truth for the About copy, shared with the prerender and
// api-server SSR render paths.
import { ABOUT_PARAGRAPHS } from "@workspace/ssr-bodies";

export default function AboutPage() {
  usePageMeta({
    title: "About",
    description:
      "World Geography Trivia makes geography fun with quizzes on capitals, flags, countries, and landmarks — for travelers, students, teachers, and lifelong learners.",
    canonical: canonicalOrigin() + "/about",
    twitterCard: "summary",
  });

  return (
    <div className="container max-w-3xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Globe className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-bold text-foreground">
          About World Geography Trivia
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Explore the world one quiz at a time.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8 text-lg leading-relaxed text-muted-foreground">
          {ABOUT_PARAGRAPHS.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </CardContent>
      </Card>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg" data-testid="button-about-browse">
          <Link href="/">
            <Compass className="mr-2 h-5 w-5" /> Browse quizzes
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" data-testid="button-about-daily">
          <Link href="/daily">
            <CalendarDays className="mr-2 h-5 w-5" /> Take the daily quiz
          </Link>
        </Button>
      </div>
    </div>
  );
}
