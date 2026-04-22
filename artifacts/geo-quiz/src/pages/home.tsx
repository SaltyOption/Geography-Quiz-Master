import { useMemo, useState } from "react";
import { useListQuizzes, useGetUserProgress, useGetCategoryTree, type CategoryNode } from "@workspace/api-client-react";
import { Link } from "wouter";
import { MapPin, Globe2, Loader2, Play, CheckCircle2, ChevronDown, ChevronRight, FolderTree, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Show } from "@clerk/react";

function collectDescendantIds(node: CategoryNode): number[] {
  return [node.id, ...node.children.flatMap(collectDescendantIds)];
}

function CategoryTreeFilter({
  nodes,
  depth,
  selectedId,
  onSelect,
  expanded,
  toggle,
}: {
  nodes: CategoryNode[];
  depth: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  expanded: Set<number>;
  toggle: (id: number) => void;
}) {
  return (
    <div>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expanded.has(node.id);
        const isSelected = selectedId === node.id;
        return (
          <div key={node.id}>
            <div
              className={`group flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm transition-colors ${
                isSelected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/60"
              }`}
              style={{ paddingLeft: `${depth * 0.75 + 0.25}rem` }}
            >
              <button
                type="button"
                onClick={() => hasChildren && toggle(node.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
                aria-label={hasChildren ? (isExpanded ? "Collapse" : "Expand") : undefined}
              >
                {hasChildren ? (
                  isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <span className="block h-1 w-1 rounded-full bg-muted-foreground/40" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : node.id)}
                className="flex flex-1 items-center gap-2 truncate text-left"
                title="Filter on this page"
              >
                <span className="truncate">{node.name}</span>
              </button>
              <Link
                href={`/category/${node.slug}`}
                className="shrink-0"
                title={`Open ${node.name} page`}
              >
                <Badge
                  variant={isSelected ? "default" : "outline"}
                  className="shrink-0 text-xs px-1.5 py-0 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                >
                  {node.quizCount}
                </Badge>
              </Link>
            </div>
            {hasChildren && isExpanded && (
              <CategoryTreeFilter
                nodes={node.children}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expanded={expanded}
                toggle={toggle}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { data: quizzes, isLoading, error } = useListQuizzes();
  const { data: progress } = useGetUserProgress();
  const { data: tree } = useGetCategoryTree();

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  // Default-expand root categories on first load
  const initializedExpand = useMemo(() => {
    if (tree && tree.length > 0 && expanded.size === 0) {
      return new Set(tree.map((n) => n.id));
    }
    return expanded;
  }, [tree, expanded]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const base = prev.size === 0 && tree ? new Set(tree.map((n) => n.id)) : new Set(prev);
      if (base.has(id)) base.delete(id);
      else base.add(id);
      return base;
    });
  };

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === null || !tree) return null;
    const find = (nodes: CategoryNode[]): CategoryNode | null => {
      for (const n of nodes) {
        if (n.id === selectedCategoryId) return n;
        const found = find(n.children);
        if (found) return found;
      }
      return null;
    };
    return find(tree)?.name ?? null;
  }, [selectedCategoryId, tree]);

  const filteredQuizzes = useMemo(() => {
    if (!quizzes) return [];
    if (selectedCategoryId === null || !tree) return quizzes;
    const find = (nodes: CategoryNode[]): CategoryNode | null => {
      for (const n of nodes) {
        if (n.id === selectedCategoryId) return n;
        const found = find(n.children);
        if (found) return found;
      }
      return null;
    };
    const node = find(tree);
    if (!node) return quizzes;
    const allowedIds = new Set(collectDescendantIds(node));
    return quizzes.filter((q) => q.categories.some((c) => allowedIds.has(c.id)));
  }, [quizzes, selectedCategoryId, tree]);

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
          <h2 className="mb-2 font-semibold">Failed to load quizzes</h2>
          <p>Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const getQuizProgress = (quizId: number) => {
    if (!progress || !progress.recentAttempts) return null;
    const attempts = progress.recentAttempts.filter(a => a.quizId === quizId);
    if (attempts.length === 0) return null;
    const bestAttempt = attempts.reduce((prev, current) => (prev.score > current.score) ? prev : current);
    return bestAttempt;
  };

  const hasCategories = tree && tree.length > 0;

  return (
    <div className="container max-w-7xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 flex flex-col gap-4 text-center md:mb-12 md:flex-row md:items-center md:justify-between md:text-left">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Explore the <span className="text-primary">World</span>
          </h1>
          <p className="mt-4 max-w-[42rem] text-lg text-muted-foreground sm:text-xl">
            Embark on a journey through continents, cultures, and landscapes. Test your geographical knowledge and discover fascinating new places.
          </p>
        </div>
        <div className="flex justify-center md:justify-end">
          <Globe2 className="h-24 w-24 text-primary/20 md:h-32 md:w-32" />
        </div>
      </div>

      <div className={hasCategories ? "grid gap-8 lg:grid-cols-[16rem_1fr]" : ""}>
        {hasCategories && (
          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FolderTree className="h-4 w-4 text-primary" />
                Browse by Category
              </div>
              {selectedCategoryId !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSelectedCategoryId(null)}
                >
                  <X className="mr-1 h-3 w-3" /> Clear
                </Button>
              )}
            </div>
            <div className="rounded-lg border bg-card p-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                  selectedCategoryId === null
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/60"
                }`}
              >
                <span>All Quizzes</span>
                <Badge variant={selectedCategoryId === null ? "default" : "outline"} className="text-xs px-1.5 py-0">
                  {quizzes?.length ?? 0}
                </Badge>
              </button>
              <div className="mt-1">
                <CategoryTreeFilter
                  nodes={tree}
                  depth={0}
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  expanded={initializedExpand}
                  toggle={toggle}
                />
              </div>
            </div>
          </aside>
        )}

        <div>
          {selectedCategoryName && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing quizzes in</span>
              <Badge variant="secondary">{selectedCategoryName}</Badge>
              <span>· {filteredQuizzes.length} {filteredQuizzes.length === 1 ? "quiz" : "quizzes"}</span>
            </div>
          )}

          {filteredQuizzes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
              <MapPin className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold">
                {selectedCategoryId !== null ? "No quizzes in this category" : "No Quizzes Available"}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {selectedCategoryId !== null
                  ? "Try selecting a different category or clear the filter."
                  : "The world is empty! Head to the admin panel to create some quizzes."}
              </p>
              {selectedCategoryId !== null ? (
                <Button className="mt-6" variant="outline" onClick={() => setSelectedCategoryId(null)}>
                  Show all quizzes
                </Button>
              ) : (
                <Button asChild className="mt-6">
                  <Link href="/admin">Go to Admin Dashboard</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredQuizzes.map((quiz, i) => {
                const quizProgress = getQuizProgress(quiz.id);
                return (
                  <Card
                    key={quiz.id}
                    className="group flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-primary/50 relative"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <CardHeader>
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant={
                          quiz.difficulty === 'hard' ? 'destructive' :
                          quiz.difficulty === 'medium' ? 'default' : 'secondary'
                        }>
                          {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">
                          {quiz.questionCount} {quiz.questionCount === 1 ? 'Question' : 'Questions'}
                        </span>
                      </div>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors pr-8">
                        {quiz.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {quiz.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {quiz.categories.length > 0 ? (
                          quiz.categories.map((c) => (
                            <Link key={c.id} href={`/category/${c.slug}`}>
                              <Badge variant="outline" className="bg-muted hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                                {c.name}
                              </Badge>
                            </Link>
                          ))
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            {quiz.category}
                          </Badge>
                        )}
                        <Show when="signed-in">
                          {quizProgress && (
                            <div className="ml-auto flex items-center text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              {Math.round(quizProgress.percentage)}% Best
                            </div>
                          )}
                        </Show>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t bg-muted/20">
                      <Button className="w-full" variant={quizProgress ? "secondary" : "default"} asChild>
                        <Link href={`/quiz/${quiz.id}`}>
                          <Play className="mr-2 h-4 w-4" /> {quizProgress ? "Retake Adventure" : "Start Adventure"}
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
