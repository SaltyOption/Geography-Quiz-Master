import { useGetCategoryTree, type CategoryNode } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Globe2, Loader2, FolderTree, ChevronRight, BookOpen } from "lucide-react";
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
  return (
    <Link href={`/category/${node.slug}`}>
      <Card className="group h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5">
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

  const roots = tree ?? [];
  const totalQuizzes = roots.reduce((sum, r) => sum + countAll(r).quizzes, 0);

  return (
    <div className="container max-w-7xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-12 flex flex-col gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Explore the <span className="text-primary">World</span>
          </h1>
          <p className="mt-4 max-w-[42rem] text-lg text-muted-foreground sm:text-xl">
            Embark on a journey through continents, cultures, and landscapes. Pick a category below to start your adventure.
          </p>
        </div>
        <div className="flex justify-center md:justify-end">
          <Globe2 className="h-24 w-24 text-primary/20 md:h-32 md:w-32" />
        </div>
      </div>

      {roots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
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
        <div className="space-y-12">
          {roots.map((root) => (
            <section key={root.id}>
              <div className="mb-5 flex items-end justify-between gap-4 border-b pb-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{root.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {countAll(root).quizzes} {countAll(root).quizzes === 1 ? "quiz" : "quizzes"} across {root.children.length} {root.children.length === 1 ? "category" : "categories"}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/category/${root.slug}`}>
                    View all <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {root.children.map((child) => (
                    <CategoryCard key={child.id} node={child} />
                  ))}
                </div>
              )}
            </section>
          ))}

          <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-2 h-5 w-5 text-primary/60" />
            {totalQuizzes} {totalQuizzes === 1 ? "quiz" : "quizzes"} in total · Pick any category above to start playing
          </div>
        </div>
      )}
    </div>
  );
}
