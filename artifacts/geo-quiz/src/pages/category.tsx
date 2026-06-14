import { useState } from "react";
import { getGetCategoryBySlugQueryKey, useGetCategoryBySlug, useGetUserProgress } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { Loader2, Play, CheckCircle2, ChevronRight, MapPin, FolderTree, ArrowLeft, Share2, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Show } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function CategoryPage() {
  const [, params] = useRoute("/category/:slug");
  const slug = params?.slug ?? "";
  const { data, isLoading, error } = useGetCategoryBySlug(slug, {
    query: { queryKey: getGetCategoryBySlugQueryKey(slug), enabled: !!slug },
  });
  const { data: progress } = useGetUserProgress();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const categoryMeta = data
    ? (() => {
        const { category, quizzes, ancestors } = data;
        const path = ancestors.map((a) => a.name).concat(category.name).join(" › ");
        const description =
          quizzes.length > 0
            ? `Explore ${quizzes.length} ${quizzes.length === 1 ? "quiz" : "quizzes"} in ${path}. Test your knowledge of ${category.name.toLowerCase()} on World Geography Trivia.`
            : `Browse the ${category.name} category on World Geography Trivia.`;
        return {
          title: category.name,
          description,
          canonical: `${window.location.origin}/category/${slug}`,
          ogImage: `${window.location.origin}/opengraph.jpg`,
        };
      })()
    : null;

  usePageMeta(categoryMeta);

  const handleShare = async () => {
    const url = window.location.href;
    const title = data ? `${data.category.name} — World Geography Trivia` : "World Geography Trivia";
    const text = data
      ? `Check out the ${data.category.name} category on World Geography Trivia`
      : "Check out this category";

    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (typeof nav.share === "function") {
        await nav.share({ title, text, url });
        return;
      }
    } catch {
      // user cancelled or share failed; fall through to clipboard
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied!", description: "The category link is in your clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Could not copy link",
        description: "Please copy it manually from the address bar.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-3xl py-16 text-center">
        <MapPin className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <h1 className="text-2xl font-semibold">Category not found</h1>
        <p className="mt-2 text-muted-foreground">The category you're looking for doesn't exist.</p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to all quizzes
          </Link>
        </Button>
      </div>
    );
  }

  const { category, ancestors, descendants, quizzes } = data;

  const getQuizProgress = (quizId: number) => {
    if (!progress?.recentAttempts) return null;
    const attempts = progress.recentAttempts.filter((a) => a.quizId === quizId);
    if (attempts.length === 0) return null;
    return attempts.reduce((p, c) => (p.score > c.score ? p : c));
  };

  // Direct children of this category (descendants whose parentId === category.id)
  const directChildren = descendants.filter((d) => d.parentId === category.id);

  return (
    <div className="container max-w-7xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="inline-flex items-center hover:text-primary">
          <FolderTree className="mr-1 h-4 w-4" />
          All Quizzes
        </Link>
        {ancestors.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/category/${a.slug}`} className="hover:text-primary">
              {a.name}
            </Link>
          </span>
        ))}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">{category.name}</span>
      </nav>

      {category.imageUrl && (
        <div className="relative mb-6 h-48 w-full overflow-hidden rounded-2xl sm:h-64 md:h-72">
          <img
            src={category.imageUrl.startsWith("/") ? `${import.meta.env.BASE_URL}${category.imageUrl.slice(1)}` : category.imageUrl}
            alt={category.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-4xl font-bold tracking-tight text-foreground drop-shadow-sm sm:text-5xl">{category.name}</h1>
          </div>
        </div>
      )}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          {!category.imageUrl && (
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{category.name}</h1>
          )}
          <p className="mt-2 text-muted-foreground">
            {quizzes.length} {quizzes.length === 1 ? "quiz" : "quizzes"}
            {descendants.length > 0
              ? ` across ${descendants.length + 1} ${descendants.length + 1 === 1 ? "category" : "categories"}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleShare} variant="outline">
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </>
            )}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to categories
            </Link>
          </Button>
        </div>
      </div>

      {directChildren.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subcategories</h2>
          <div className="flex flex-wrap gap-2">
            {directChildren.map((child) => (
              <Button key={child.id} asChild variant="outline" size="sm">
                <Link href={`/category/${child.slug}`}>
                  <FolderTree className="mr-1.5 h-3.5 w-3.5" />
                  {child.name}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <MapPin className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">No quizzes here yet</h2>
          <p className="mt-2 text-muted-foreground">
            Check back later or browse other categories.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Browse all quizzes</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((quiz, i) => {
            const quizProgress = getQuizProgress(quiz.id);
            return (
              <Card
                key={quiz.id}
                className="group flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-primary/50"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge
                      variant={
                        quiz.difficulty === "hard"
                          ? "destructive"
                          : quiz.difficulty === "medium"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                      {quiz.questionCount} {quiz.questionCount === 1 ? "Question" : "Questions"}
                    </span>
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{quiz.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {quiz.categories.map((c) => (
                      <Link key={c.id} href={`/category/${c.slug}`}>
                        <Badge
                          variant={c.id === category.id ? "default" : "outline"}
                          className={c.id === category.id ? "" : "bg-muted hover:bg-muted/80 cursor-pointer"}
                        >
                          {c.name}
                        </Badge>
                      </Link>
                    ))}
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
  );
}
