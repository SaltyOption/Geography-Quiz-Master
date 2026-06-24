import { Link } from "wouter";
import { useListFactoids, useListArticles } from "@workspace/api-client-react";
import { isSafeHttpUrl } from "@workspace/markdown";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { Lightbulb, BookOpen, ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DidYouKnowPage() {
  usePageMeta({
    title: "Did You Know?",
    description:
      "Surprising geography facts and in-depth articles about countries, capitals, landmarks, and the natural world.",
    canonical: canonicalOrigin() + "/did-you-know",
  });

  const { data: factoids, isLoading: factoidsLoading } = useListFactoids();
  const { data: articles, isLoading: articlesLoading } = useListArticles();

  const isLoading = factoidsLoading || articlesLoading;
  const factoidList = factoids ?? [];
  const articleList = articles ?? [];

  return (
    <div className="container max-w-6xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-12 text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary/15 text-secondary">
          <Lightbulb className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Did You Know?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Surprising geography facts and longer reads about the people, places, and
          natural wonders that make our world fascinating.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-16">
          {/* Factoids */}
          <section>
            <div className="mb-5 flex items-center gap-2 border-b pb-3">
              <Lightbulb className="h-6 w-6 text-secondary" />
              <h2 className="text-2xl font-bold tracking-tight">Quick Facts</h2>
            </div>
            {factoidList.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No facts yet — check back soon!
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {factoidList.map((f) => (
                  <Card
                    key={f.id}
                    className="flex h-full flex-col border-l-4 border-l-secondary/60"
                    data-testid={`card-factoid-${f.id}`}
                  >
                    <CardContent className="flex flex-1 flex-col gap-3 p-6">
                      <p className="text-base leading-relaxed text-foreground">{f.text}</p>
                      {isSafeHttpUrl(f.sourceUrl) ? (
                        <a
                          href={f.sourceUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {f.sourceLabel || "Source"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : f.sourceLabel ? (
                        <span className="mt-auto text-sm text-muted-foreground">
                          {f.sourceLabel}
                        </span>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Articles */}
          <section>
            <div className="mb-5 flex items-center gap-2 border-b pb-3">
              <BookOpen className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Articles</h2>
            </div>
            {articleList.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No articles yet — check back soon!
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {articleList.map((a) => (
                  <Link
                    key={a.id}
                    href={`/did-you-know/${a.slug}`}
                    data-testid={`link-article-${a.slug}`}
                  >
                    <Card className="group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
                      {a.imageUrl && (
                        <div className="relative h-40 w-full overflow-hidden bg-muted">
                          <img
                            src={a.imageUrl}
                            alt={a.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="text-xl transition-colors group-hover:text-primary">
                          {a.title}
                        </CardTitle>
                        {a.summary && (
                          <CardDescription className="line-clamp-3">
                            {a.summary}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="mt-auto flex items-center justify-between pt-0 text-sm text-muted-foreground">
                        <span>{formatDate(a.createdAt)}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-primary">
                          Read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
