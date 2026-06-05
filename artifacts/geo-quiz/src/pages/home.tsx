import { useState } from "react";
import { useGetCategoryTree, useListQuizzes, useListCourses, type CategoryNode } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Loader2, FolderTree, ChevronRight, ChevronDown, ChevronUp, BookOpen, GraduationCap, Sparkles, Compass } from "lucide-react";
import mascotUrl from "@assets/mascot_swallow.png";
import { SignUpBanner } from "@/components/SignUpBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const baseUrl = import.meta.env.BASE_URL;
  const imgSrc = node.imageUrl
    ? (node.imageUrl.startsWith("/") ? `${baseUrl}${node.imageUrl.slice(1)}` : node.imageUrl)
    : null;
  return (
    <Link href={`/category/${node.slug}`}>
      <Card className="group h-full cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5">
        {imgSrc && (
          <div className="relative h-32 w-full overflow-hidden bg-muted">
            <img
              src={imgSrc}
              alt={node.name}
              loading="lazy"
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

export default function Home() {
  const { data: tree, isLoading, error } = useGetCategoryTree();
  const { data: quizzes } = useListQuizzes();
  const { data: courses } = useListCourses();
  const [showAllCourses, setShowAllCourses] = useState(false);
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

  const ROOT_ORDER = ["By Topic", "By Region"];
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
      <SignUpBanner />
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
              <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
                Continents, capitals, cultures, and landscapes — one quick quiz at a time.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                <Button asChild size="lg" data-testid="button-hero-daily">
                  <Link href="/daily">
                    <Sparkles className="mr-2 h-4 w-4" /> Daily quiz
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" data-testid="button-hero-browse">
                  <Link href="#quizzes">
                    <Compass className="mr-2 h-4 w-4" /> Browse quizzes
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex shrink-0 justify-center md:justify-end">
              <img
                src={mascotUrl}
                alt="Geography quiz mascot"
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

        {roots.length === 0 ? (
          <div id="quizzes" className="scroll-mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
            <FolderTree className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">No categories yet</h2>
            <p className="mt-2 text-muted-foreground">
              Head to the admin panel to create your first category and quizzes.
            </p>
            <Button asChild className="mt-6">
              <Link href="/admin">Go to Admin Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div id="quizzes" className="space-y-12 scroll-mt-20">
            {/* Quizzes first */}
            {roots.map((root) => (
              <section key={root.id}>
                <div className="mb-5 flex items-end justify-between gap-4 border-b pb-3">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{root.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {countAll(root).quizzes} {countAll(root).quizzes === 1 ? "quiz" : "quizzes"} across {root.children.length} {root.children.length === 1 ? "category" : "categories"}
                    </p>
                  </div>
                  {root.children.length > 2 ? (
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
                        <>View all <ChevronDown className="ml-1 h-4 w-4" /></>
                      )}
                    </Button>
                  ) : (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/category/${root.slug}`}>
                        View all <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>

                {root.children.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No subcategories yet.{" "}
                      <Link href={`/category/${root.slug}`} className="text-primary hover:underline">
                        Browse {root.name}
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {root.children
                      .slice(0, expandedRoots[root.id] ? undefined : 2)
                      .map((child) => (
                        <CategoryCard key={child.id} node={child} />
                      ))}
                  </div>
                )}
              </section>
            ))}

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
                  {courseList.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="button-home-courses-toggle"
                      onClick={() => setShowAllCourses((v) => !v)}
                    >
                      {showAllCourses ? (
                        <>Show less <ChevronUp className="ml-1 h-4 w-4" /></>
                      ) : (
                        <>View all <ChevronDown className="ml-1 h-4 w-4" /></>
                      )}
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courseList.slice(0, showAllCourses ? undefined : 3).map((c) => (
                    <Link key={c.id} href={`/courses/${c.slug}`}>
                      <Card className="group h-full cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5">
                        <CardHeader>
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary">
                              <GraduationCap className="h-5 w-5" />
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                          </div>
                          <CardTitle className="text-xl group-hover:text-primary transition-colors">
                            {c.title}
                          </CardTitle>
                          {c.description && (
                            <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-muted-foreground">
                            {c.moduleCount} module{c.moduleCount === 1 ? "" : "s"}
                            {c.masteredCount > 0 && (
                              <> · <span className="text-green-700 dark:text-green-300 font-medium">{c.masteredCount} mastered</span></>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
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
