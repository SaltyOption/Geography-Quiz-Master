import { Link } from "wouter";
import type { SeoArticle } from "@workspace/seo-content";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Article teaser card — shared by the homepage Articles section and the
 * /articles index. Whole card is the link, per the design handoff.
 */
export function ArticleCard({ article }: { article: SeoArticle }) {
  return (
    <Link href={`/articles/${article.slug}`}>
      <Card className="group flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5">
        <img
          src={article.illustration}
          alt={article.illustrationAlt}
          loading="lazy"
          decoding="async"
          className="h-[130px] w-full object-cover"
        />
        <CardHeader className="flex flex-1 flex-col gap-1.5">
          <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
            {article.title}
          </CardTitle>
          <CardDescription className="text-[13px] leading-snug">
            {article.cardDescription}
          </CardDescription>
          <p className="mt-auto pt-3 text-xs text-muted-foreground">
            {article.readMinutes} min read
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}
