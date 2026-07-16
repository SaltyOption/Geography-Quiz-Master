import { useState } from "react";
import { useGetCategoryTree, useListQuizzes, useListCourses, useGetMe, useGetUserProgress, type CategoryNode, type QuizSummary, type CourseSummary } from "@workspace/api-client-react";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { Link } from "wouter";
import { Loader2, FolderTree, ChevronRight, ChevronDown, ChevronUp, BookOpen, GraduationCap, Sparkles, ArrowRight, Play, Compass, Image as ImageIcon } from "lucide-react";
import { SEO_ARTICLES } from "@workspace/seo-content";
import { Mascot } from "@/components/Mascot";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { ArticleCard } from "@/components/ArticleCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

function countAll(node: CategoryNode): { quizzes: number; subcategories: number } {
  let quizzes = node.quizCount;
  let subcategories = node.children.length;
  for (const child of node.children) {
    const sub = countAll(child);
    quizzes += sub.quizzes;
    subcategories += sub.subcategories;
  }
  // Note: quizCount on a parent may double-count if quizzes are tagged on both parent and child;
  // dedupe per-quiz counting is done server-side on the category page, but this header total is approximate.
  return { quizzes, subcategories };
}

function CategoryCard({ node }: { node: CategoryNode }) {
  const totals = countAll(node);
  return (
    <Link href={`/category/${node.slug}`}>
      <Card className="group h-full cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5">
        {node.imageUrl && (
          <div className="relative h-32 w-full overflow-hidden bg-muted">
            <ResponsiveImage
              src={node.imageUrl}
              alt={node.name}
              loading="lazy"
              decoding="async"
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          </div>
        )}
        <CardHeader>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <FolderTree className="h-5 w-5" />
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </div>
          <CardTitle className="text-xl group-hover:text-primary transition-colors">{node.name}</CardTitle>
          <CardDescription className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {totals.quizzes} {totals.quizzes === 1 ? "quiz" : "quizzes"}
            </span>
            {node.children.length > 0 && (
              <span>
                · {node.children.length} {node.children.length === 1 ? "subcategory" : "subcategories"}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        {node.children.length > 0 && (
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {node.children.map((child) => (
                <Badge key={child.id} variant="outline" className="bg-muted/60 font-normal">
                  {child.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}

// The By Topic and By Region rails each show four featured categories (in
// this order) ahead of the rest, with hand-written taglines from the design
// handoff; other categories fall back to no tagline.
const FEATURED_CATEGORY_SLUGS = [
  "ancient-sites", "capitals", "flags", "physical-geography",
  "africa", "europe", "east-asia", "antarctica",
];
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "ancient-sites": "Pyramids, temples, and lost cities of the ancient world.",
  capitals: "From Reykjavik to Wellington — name every capital city.",
  flags: "Stripes, stars, and crescents — match flags to their nations.",
  "physical-geography": "Mountains, deserts, rivers, and the forces that shape them.",
  africa: "54 countries, from the Sahara to the Cape of Good Hope.",
  europe: "Capitals, coastlines, and countries of the old continent.",
  "east-asia": "From the Gobi Desert to the islands of Japan.",
  antarctica: "The frozen continent — stations, seas, and ice shelves.",
  asia: "Mountains, megacities, and monsoons across the largest continent.",
  "north-america": "Great lakes, deserts, and coastlines from Canada to Panama.",
};

// Courses have no imagery of their own yet; reuse the closest category art so
// the Learning Courses rail matches the card anatomy of the other sections.
const COURSE_ART: Record<string, string> = {
  "oceans-and-seas": "/regions/oceans-and-seas.png",
  "rivers-and-lakes": "/regions/lakes-and-rivers.png",
  "world-deserts": "/regions/physical-geography.png",
};
const COURSE_DESCRIPTIONS: Record<string, string> = {
  "oceans-and-seas": "Currents, trenches, and the five oceans — how the water world works.",
  "rivers-and-lakes": "Follow the Nile, Amazon, and Mekong from source to sea.",
  "world-deserts": "Hot, cold, and coastal — life in Earth's driest places.",
};

function featuredFirst(children: CategoryNode[]): CategoryNode[] {
  const rank = (n: CategoryNode) => {
    const i = FEATURED_CATEGORY_SLUGS.indexOf(n.slug);
    return i === -1 ? Infinity : i;
  };
  return [...children].sort((a, b) => rank(a) - rank(b));
}

function CategoryTile({
  node,
  imagePosition = "center",
}: {
  node: CategoryNode;
  // Region map art carries a title banner at the top of the frame, so the
  // By Region rail anchors the crop there; other art centers its subject.
  imagePosition?: "top" | "center";
}) {
  const totals = countAll(node);
  const description = CATEGORY_DESCRIPTIONS[node.slug];
  return (
    <Link href={`/category/${node.slug}`}>
      <Card className="group flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5">
        <div className="relative h-[140px] w-full overflow-hidden bg-muted">
          {node.imageUrl ? (
            <ResponsiveImage
              src={node.imageUrl}
              alt={node.name}
              loading="lazy"
              decoding="async"
              sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${imagePosition === "top" ? "object-top" : ""}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <CardHeader className="flex flex-1 flex-col gap-1.5">
          <CardTitle className="text-base group-hover:text-primary transition-colors">
            {node.name}
          </CardTitle>
          {description && (
            <CardDescription className="text-[13px] leading-snug">{description}</CardDescription>
          )}
          <p className="mt-auto pt-3 text-xs text-muted-foreground">
            {totals.quizzes} {totals.quizzes === 1 ? "quiz" : "quizzes"}
            {node.children.length > 0 && (
              <> · {node.children.length} {node.children.length === 1 ? "subcategory" : "subcategories"}</>
            )}
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}

function CourseTile({ course }: { course: CourseSummary }) {
  const art = course.imageUrl ?? COURSE_ART[course.slug];
  const description = COURSE_DESCRIPTIONS[course.slug] ?? course.description;
  return (
    <Link href={`/courses/${course.slug}`}>
      <Card className="group flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5">
        <div className="relative h-[130px] w-full overflow-hidden bg-muted">
          {art ? (
            <ResponsiveImage
              src={art}
              alt={course.title}
              loading="lazy"
              decoding="async"
              sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 90vw"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <CardHeader className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base group-hover:text-primary transition-colors">
              {course.title}
            </CardTitle>
            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              {course.moduleCount} module{course.moduleCount === 1 ? "" : "s"}
            </span>
          </div>
          {description && (
            <CardDescription className="text-[13px] leading-snug">{description}</CardDescription>
          )}
          {course.masteredCount > 0 && (
            <p className="mt-auto pt-2 text-xs font-medium text-green-700 dark:text-green-300">
              {course.masteredCount} mastered
            </p>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}

/**
 * Presents the World Cup quizzes as one multi-part series: numbered circles for
 * each part (filled once attempted), a progress bar, and a Continue button that
 * jumps to the first part the user hasn't completed yet. Completion comes from
 * the signed-in user's attempt history; anonymous users simply see everything
 * as not-yet-started, same as the category page.
 */
function WorldCupSeriesCard({ quizzes }: { quizzes: QuizSummary[] }) {
  const { data: progress } = useGetUserProgress();
  const parts = [...quizzes].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { numeric: true }),
  );
  const completedIds = new Set((progress?.recentAttempts ?? []).map((a) => a.quizId));
  const completedCount = parts.filter((p) => completedIds.has(p.id)).length;
  const totalQuestions = parts.reduce((sum, q) => sum + q.questionCount, 0);
  const nextPart = parts.find((p) => !completedIds.has(p.id)) ?? parts[0];
  const difficulty = parts[0].difficulty;

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 flex items-center gap-3">
              <Badge
                variant={
                  difficulty === "hard"
                    ? "destructive"
                    : difficulty === "medium"
                      ? "default"
                      : "secondary"
                }
              >
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {parts.length} {parts.length === 1 ? "part" : "parts"} · {totalQuestions} questions
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">World Cup Flags</h3>
            <p className="mt-2 text-muted-foreground">
              Match the flag of every qualified nation, from Argentina to Uzbekistan — in{" "}
              {parts.length} quick rounds of {parts[0].questionCount}.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Progress
                value={(completedCount / parts.length) * 100}
                className="w-full max-w-[280px]"
                aria-label={`${completedCount} of ${parts.length} parts complete`}
              />
              <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                {completedCount} of {parts.length} complete
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5">
              {parts.map((part, i) => {
                const done = completedIds.has(part.id);
                return (
                  <Link
                    key={part.id}
                    href={`/quiz/${part.id}`}
                    aria-label={`Part ${i + 1}: ${part.title}${done ? " (completed)" : ""}`}
                    data-testid={`link-world-cup-part-${i + 1}`}
                    className={
                      done
                        ? "flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-105"
                        : "flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-background text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    }
                  >
                    {i + 1}
                  </Link>
                );
              })}
            </div>
            <Button asChild size="lg" className="rounded-full" data-testid="button-world-cup-continue">
              <Link href={`/quiz/${nextPart.id}`}>
                {completedCount > 0 ? "Continue" : "Start"} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  usePageMeta({
    title: "World Geography Trivia",
    description:
      "Play world geography quizzes and short courses covering capitals, countries, landmarks, and regions.",
    canonical: canonicalOrigin() + "/",
  });

  const { data: tree, isLoading, error } = useGetCategoryTree();
  const { data: quizzes } = useListQuizzes();
  const { data: courses } = useListCourses();
  const { data: me } = useGetMe();
  const isAdmin = me?.isAdmin ?? false;
  const [expandedRoots, setExpandedRoots] = useState<Record<number, boolean>>({});

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          <h2 className="mb-2 font-semibold">Failed to load categories</h2>
          <p>Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const QUIZ_LIST_ROOT = "World Cup 2026";
  const ROOT_ORDER = ["World Cup 2026", "By Topic", "By Region"];
  const roots = [...(tree ?? [])].sort((a, b) => {
    const ai = ROOT_ORDER.indexOf(a.name);
    const bi = ROOT_ORDER.indexOf(b.name);
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    }
    return a.name.localeCompare(b.name);
  });
  const totalQuizzes = quizzes?.length ?? 0;

  const courseList = courses ?? [];
  const totalCategories = roots.reduce((sum, r) => sum + r.children.length, 0);

  return (
    <>
      <div className="container max-w-7xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Hero */}
        <section className="relative mb-12 overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> World Geography Trivia
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Explore the <span className="text-secondary">World</span>
              </h1>
              <p className="mt-4 max-w-md text-lg text-muted-foreground sm:text-xl">
                Continents, capitals, cultures, and landscapes — one quick quiz at a
                time. Save your scores and watch your streak grow.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
                <Button asChild size="lg" className="rounded-full" data-testid="button-hero-daily">
                  <Link href="/daily">
                    <Play className="mr-2 h-4 w-4" /> Play today's quiz
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="rounded-full" data-testid="button-hero-atlas">
                  <Link href="/guess-the-country">
                    <Compass className="mr-2 h-4 w-4" /> Where's Atlas?
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full"
                  data-testid="button-hero-browse"
                  onClick={() =>
                    document
                      .getElementById("quizzes")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  Browse all quizzes
                </Button>
              </div>
            </div>
            <div className="flex shrink-0 justify-center md:justify-end">
              <Mascot
                variant="default"
                alt="Geography quiz mascot"
                sizes="(min-width: 1024px) 256px, (min-width: 768px) 224px, 160px"
                loading="eager"
                className="h-40 w-40 object-contain drop-shadow-lg md:h-56 md:w-56 lg:h-64 lg:w-64"
              />
            </div>
          </div>

          {(totalQuizzes > 0 || courseList.length > 0 || totalCategories > 0) && (
            <div className="relative mt-8 grid grid-cols-3 gap-3 border-t pt-6 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground sm:text-3xl">{totalQuizzes}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Quizzes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground sm:text-3xl">{totalCategories}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Categories</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground sm:text-3xl">{courseList.length}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Courses</div>
              </div>
            </div>
          )}
        </section>

        {/* Where's Atlas? — daily country-guessing game */}
        <section className="mb-12">
          <div
            className="relative overflow-hidden rounded-3xl border border-[#25506f] px-6 py-8 sm:px-10 sm:py-10"
            style={{ background: "linear-gradient(135deg, #0b2233 0%, #12314a 100%)" }}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#ff7a5c]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[#3fc9a5]/10 blur-3xl" />
            <div className="relative flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
              <div className="max-w-xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e4c580]/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e4c580]">
                  <Compass className="h-3.5 w-3.5" /> New · Daily Game
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-[#e8f1f4] sm:text-4xl">
                  Where's <span className="text-[#ff7a5c]">Atlas?</span>
                </h2>
                <p className="mt-3 text-[#8fb0bf] sm:text-lg">
                  Atlas the swallow has flown to a mystery country. Find it in six guesses
                  using capital-to-capital <span className="text-[#e8f1f4]">distance</span> and{" "}
                  <span className="text-[#e8f1f4]">direction</span> hints — a brand-new puzzle every day.
                </p>
                <div className="mt-6 flex justify-center md:justify-start">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-[#ff7a5c] text-[#0b2233] hover:bg-[#ff7a5c]/90"
                    data-testid="button-atlas-play"
                  >
                    <Link href="/guess-the-country">
                      Play Where's Atlas <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex shrink-0 justify-center md:justify-end">
                <img
                  src="/atlas-mascot.png"
                  alt="Atlas the swallow"
                  width={361}
                  height={460}
                  loading="lazy"
                  decoding="async"
                  className="h-32 w-auto object-contain drop-shadow-lg sm:h-40 md:h-44"
                />
              </div>
            </div>
          </div>
        </section>

        {roots.length === 0 ? (
          <div id="quizzes" className="scroll-mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
            <FolderTree className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">
              {isAdmin ? "No categories yet" : "Quizzes are on their way"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {isAdmin
                ? "Head to the admin panel to create your first category and quizzes."
                : "New geography quizzes are being prepared. Please check back soon!"}
            </p>
            {isAdmin && (
              <Button asChild className="mt-6">
                <Link href="/admin">Go to Admin Dashboard</Link>
              </Button>
            )}
          </div>
        ) : (
          <div id="quizzes" className="space-y-12 scroll-mt-20">
            {/* Quizzes first */}
            {roots.map((root) => {
              const isQuizListRoot = root.name === QUIZ_LIST_ROOT;
              const isRailRoot = root.name === "By Topic" || root.name === "By Region";
              const linkedQuizzes = isQuizListRoot
                ? (quizzes ?? []).filter((q) => q.categories.some((c) => c.id === root.id))
                : [];
              return (
                <section
                  key={root.id}
                  id={root.name === "By Region" ? "by-region" : undefined}
                  className={root.name === "By Region" ? "scroll-mt-20" : undefined}
                >
                  <div className="mb-5 flex items-end justify-between gap-4 border-b pb-3">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">
                        {isQuizListRoot && (
                          <span aria-hidden="true" className="mr-2">
                            🏆
                          </span>
                        )}
                        {root.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {isQuizListRoot ? (
                          <>The tournament is on — how well do you know the 48 qualified nations?</>
                        ) : (
                          <>
                            {countAll(root).quizzes} {countAll(root).quizzes === 1 ? "quiz" : "quizzes"} across {root.children.length} {root.children.length === 1 ? "category" : "categories"}
                          </>
                        )}
                      </p>
                    </div>
                    {isRailRoot ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/category/${root.slug}`}>
                          View all {root.children.length} <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : !isQuizListRoot && root.children.length > 2 ? (
                      <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/category/${root.slug}`}>
                            View all <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-home-root-toggle-${root.id}`}
                          onClick={() =>
                            setExpandedRoots((prev) => ({ ...prev, [root.id]: !prev[root.id] }))
                          }
                        >
                          {expandedRoots[root.id] ? (
                            <>Show less <ChevronUp className="ml-1 h-4 w-4" /></>
                          ) : (
                            <>Expand <ChevronDown className="ml-1 h-4 w-4" /></>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/category/${root.slug}`}>
                          View all <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>

                  {isQuizListRoot ? (
                    linkedQuizzes.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                          No quizzes yet.{" "}
                          <Link href={`/category/${root.slug}`} className="text-primary hover:underline">
                            Browse {root.name}
                          </Link>
                        </CardContent>
                      </Card>
                    ) : (
                      <WorldCupSeriesCard quizzes={linkedQuizzes} />
                    )
                  ) : root.children.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        No subcategories yet.{" "}
                        <Link href={`/category/${root.slug}`} className="text-primary hover:underline">
                          Browse {root.name}
                        </Link>
                      </CardContent>
                    </Card>
                  ) : isRailRoot ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {featuredFirst(root.children).slice(0, 4).map((child) => (
                        <CategoryTile
                          key={child.id}
                          node={child}
                          imagePosition={root.name === "By Region" ? "top" : "center"}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {root.children.map((child, i) => (
                        <div key={child.id} className={!expandedRoots[root.id] && i >= 2 ? "hidden" : undefined}>
                          <CategoryCard node={child} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Learning Courses (after quizzes) */}
            {courseList.length > 0 && (
              <section>
                <div className="mb-5 flex items-end justify-between gap-4 border-b pb-3">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                      <GraduationCap className="h-6 w-6 text-secondary" /> Learning Courses
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Layered modules with explanations and fun facts. Master each module to unlock the next.
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/courses">
                      View all {courseList.length} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courseList.slice(0, 3).map((c) => (
                    <CourseTile key={c.id} course={c} />
                  ))}
                </div>
              </section>
            )}

            {/* Articles */}
            {SEO_ARTICLES.length > 0 && (
              <section>
                <div className="mb-5 flex items-end justify-between gap-4 border-b pb-3">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                      <BookOpen className="h-6 w-6 text-secondary" /> Articles
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      The geography stories behind the quizzes
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/articles">
                      View all {SEO_ARTICLES.length} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SEO_ARTICLES.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            )}

            <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <BookOpen className="mx-auto mb-2 h-5 w-5 text-secondary" />
              {totalQuizzes} {totalQuizzes === 1 ? "quiz" : "quizzes"} in total · Pick any category above to start an adventure
            </div>
          </div>
        )}
      </div>
    </>
  );
}
