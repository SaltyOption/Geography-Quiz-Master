import { Link, useParams } from "wouter";
import { useGetArticleBySlug } from "@workspace/api-client-react";
import { renderMarkdown } from "@workspace/markdown";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { ChevronRight, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ArticleDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { data: article, isLoading, error } = useGetArticleBySlug(slug);

  usePageMeta(
    article
      ? {
          title: article.title,
          description:
            article.summary ||
            `Read "${article.title}" on World Geography Trivia.`,
          canonical: canonicalOrigin() + `/did-you-know/${article.slug}`,
          ogType: "article",
          ...(article.imageUrl
            ? { ogImage: article.imageUrl, twitterCard: "summary_large_image" as const }
            : {}),
        }
      : null,
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container max-w-3xl py-16 text-center">
        <Lightbulb className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <h1 className="text-2xl font-bold">Article not found</h1>
        <p className="mt-2 text-muted-foreground">
          This article may have been removed or is not yet published.
        </p>
        <Button asChild className="mt-6">
          <Link href="/did-you-know">Back to Did You Know</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/did-you-know" className="hover:text-foreground hover:underline">
          Did You Know
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="truncate font-medium text-foreground">{article.title}</span>
      </nav>

      <article>
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Published {formatDate(article.createdAt)}
          </p>
          {article.summary && (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          )}
        </header>

        {article.imageUrl && (
          <div className="mb-8 overflow-hidden rounded-2xl border bg-muted">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="h-auto w-full object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
        )}

        <div
          className="prose prose-stone max-w-none prose-headings:font-bold prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
        />
      </article>

      <div className="mt-12 border-t pt-8">
        <Button asChild variant="outline">
          <Link href="/did-you-know">← Back to Did You Know</Link>
        </Button>
      </div>
    </div>
  );
}
