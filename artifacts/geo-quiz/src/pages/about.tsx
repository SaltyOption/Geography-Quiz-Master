import { Link } from "wouter";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { Globe, Compass, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const paragraphs: string[] = [
  "World Geography Trivia helps curious learners explore the world one quiz at a time.",
  "Whether you are brushing up on capitals, testing your knowledge of flags, learning where countries are located, or discovering famous landmarks, this site is designed to make geography feel fun, approachable, and memorable.",
  "The goal is simple: help you build real geographic knowledge without making it feel like homework. Each quiz is meant to teach as well as test, with questions that encourage you to notice patterns, make connections, and learn something new about the world.",
  "World Geography Trivia is for travelers, lifelong learners, trivia fans, students, teachers, and anyone who has ever looked at a map and thought, “I should probably know more about that place.”",
  "So pick a quiz, follow your curiosity, and see where in the world it takes you.",
];

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
          {paragraphs.map((p) => (
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
