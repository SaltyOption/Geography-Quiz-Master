import { SEO_ARTICLES } from "@workspace/seo-content";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { ArticleCard } from "@/components/ArticleCard";

export default function ArticlesIndexPage() {
  usePageMeta({
    title: "Articles",
    description:
      "Geography articles from World Geography Trivia — the stories behind the quizzes.",
    canonical: canonicalOrigin() + "/articles",
  });

  return (
    <div className="container max-w-6xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8 border-b pb-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          📖 Articles
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The geography stories behind the quizzes
        </p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SEO_ARTICLES.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  );
}
