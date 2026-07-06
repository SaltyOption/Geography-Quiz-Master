import { Link, useParams } from "wouter";
import { getSeoArticle, SEO_ARTICLES } from "@workspace/seo-content";
import { renderMarkdown } from "@workspace/markdown";
import { useListQuizzes } from "@workspace/api-client-react";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { BookOpen, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function DifficultyPill({ difficulty }: { difficulty: string }) {
  return (
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
  );
}

/** Render a markdown snippet inline (no wrapping <p>). */
function inlineMarkdown(md: string): string {
  return renderMarkdown(md)
    .replace(/^<p>/, "")
    .replace(/<\/p>\s*$/, "");
}

export default function SeoArticlePage() {
  const params = useParams<{ slug: string }>();
  const article = getSeoArticle(params.slug ?? "");
  const { data: quizzes } = useListQuizzes();

  usePageMeta(
    article
      ? {
          title: article.title,
          description: article.metaDescription,
          canonical: canonicalOrigin() + `/articles/${article.slug}`,
          ogType: "article",
        }
      : null,
  );

  if (!article) {
    return (
      <div className="container max-w-3xl py-16 text-center">
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <h1 className="text-2xl font-bold">Article not found</h1>
        <p className="mt-2 text-muted-foreground">
          This article may have moved or never existed.
        </p>
        <Button asChild className="mt-6">
          <Link href="/articles">Browse all articles</Link>
        </Button>
      </div>
    );
  }

  const relatedQuizzes = article.relatedQuizIds
    .map((id) => (quizzes ?? []).find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q));
  const moreArticles = SEO_ARTICLES.filter((a) => a.slug !== article.slug);

  return (
    <div className="container max-w-6xl py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
        <Link href="/" className="hover:text-foreground hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/articles" className="hover:text-foreground hover:underline">
          Articles
        </Link>{" "}
        / <span className="text-foreground/80">{article.title}</span>
      </nav>

      {/* Header */}
      <header className="mt-5">
        <span className="inline-block rounded-md bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-secondary">
          {article.tag}
        </span>
        <h1 className="mt-3.5 max-w-[820px] font-serif text-4xl font-bold leading-[1.12] tracking-tight sm:text-[44px]">
          {article.title}
        </h1>
        <p className="mt-2.5 text-sm text-muted-foreground">
          {article.publishedLabel} · {article.readMinutes} min read
        </p>
        <div className="mt-7 overflow-hidden rounded-[20px] bg-muted">
          <img
            src={article.illustration}
            alt={article.illustrationAlt}
            loading="eager"
            decoding="async"
            className="h-[220px] w-full object-cover sm:h-[340px]"
          />
        </div>
      </header>

      {/* Two-column body */}
      <div className="mt-10 items-start gap-14 lg:grid lg:grid-cols-[1fr_300px]">
        <article>
          <div
            className="text-[17px] leading-[1.72] text-foreground/85
              [&>p:first-child]:text-xl [&>p:first-child]:leading-[1.6] [&>p:first-child]:text-foreground
              [&_p]:mb-[18px]
              [&_a]:font-semibold [&_a]:text-primary hover:[&_a]:underline
              [&_h2]:mb-3.5 [&_h2]:mt-9 [&_h2]:font-serif [&_h2]:text-[26px] [&_h2]:font-bold [&_h2]:leading-[1.25] [&_h2]:text-foreground sm:[&_h2]:text-[28px]
              [&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:text-foreground
              [&_ul]:mb-[18px] [&_ul]:list-disc [&_ul]:pl-[22px] [&_ol]:mb-[18px] [&_ol]:list-decimal [&_ol]:pl-[22px] [&_li]:mb-2
              [&_table]:my-2 [&_table]:mb-[18px] [&_table]:w-full [&_table]:border-separate [&_table]:[border-spacing:0] [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:bg-card [&_table]:text-[14.5px]
              [&_th]:bg-primary [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-primary-foreground
              [&_td]:border-t [&_td]:px-3.5 [&_td]:py-2"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
          />

          {/* FAQ cards */}
          {article.faqs.length > 0 && (
            <section aria-label="Frequently asked questions" className="mt-9">
              <h2 className="mb-3.5 font-serif text-[26px] font-bold leading-[1.25] sm:text-[28px]">
                Common Questions
              </h2>
              {article.faqs.map((faq) => (
                <Card key={faq.question} className="mb-3">
                  <CardContent className="px-5 py-4">
                    <p className="mb-1.5 font-bold">{faq.question}</p>
                    <p
                      className="text-[15px] leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-primary"
                      dangerouslySetInnerHTML={{ __html: inlineMarkdown(faq.answer) }}
                    />
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {/* Quiz CTA band — the article→quiz growth mechanic */}
          <div className="mt-12 rounded-[20px] border bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-7 py-9 sm:px-10">
            <h2 className="mb-2 font-serif text-[26px] font-bold leading-[1.25] sm:text-[28px]">
              {article.cta.heading}
            </h2>
            <p className="mb-5 text-muted-foreground">{article.cta.text}</p>
            <div className="flex flex-wrap items-center gap-3">
              {article.cta.buttons.map((btn, i) => (
                <Button
                  key={btn.href}
                  asChild
                  size="lg"
                  variant={i === 0 ? "default" : "outline"}
                  className="rounded-full"
                >
                  <Link href={btn.href}>
                    {i === 0 && <Play className="mr-2 h-4 w-4" />}
                    {btn.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="mt-10 space-y-4 lg:sticky lg:top-24 lg:mt-0">
          {relatedQuizzes.length > 0 && (
            <Card>
              <CardContent className="px-5 py-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Test yourself
                </p>
                {relatedQuizzes.map((quiz, i) => (
                  <Link
                    key={quiz.id}
                    href={`/quiz/${quiz.id}`}
                    className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t" : ""}`}
                  >
                    <span className="flex-1">
                      <span className="block text-sm font-bold hover:text-primary">
                        {quiz.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {quiz.questionCount} questions
                      </span>
                    </span>
                    <DifficultyPill difficulty={quiz.difficulty} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="px-5 py-5">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                More articles
              </p>
              {moreArticles.map((a, i) => (
                <Link
                  key={a.slug}
                  href={`/articles/${a.slug}`}
                  className={`block py-2 text-sm font-semibold leading-snug text-primary hover:underline ${i > 0 ? "border-t" : ""}`}
                >
                  {a.title}
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
