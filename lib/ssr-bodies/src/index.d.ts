export declare const SITE_NAME: string;

export declare const ABOUT_PARAGRAPHS: readonly string[];

export declare function esc(str: unknown): string;

export declare function sharedNav(): string;

export declare function dailyBody(): string;

export declare function privacyBody(): string;

export declare function aboutBody(): string;

export declare function homeBody(
  categories: { id: number; name: string; slug: string; parentId: number | null }[],
  courses: { slug: string; title: string }[],
): string;

export declare function quizBody(quiz: {
  id: number;
  title: string;
  description: string | null;
  difficulty: string;
  questionCount: number;
  categories: { name: string; slug: string }[];
  questions: { text: string; options: string[]; imageUrl: string | null }[];
}): string;

export declare function categoryBody(
  category: { name: string },
  ancestors: { name: string; slug: string }[],
  subcategories: { name: string; slug: string }[],
  quizzes: { id: number; title: string; difficulty: string }[],
): string;

export declare function coursesBody(
  courses: { slug: string; title: string; description: string | null }[],
): string;

export declare function courseDetailBody(
  course: { title: string; description: string | null },
  modules: { title: string; description: string | null }[],
): string;

export declare function didYouKnowBody(
  factoids: { text: string; sourceLabel: string | null; sourceUrl: string | null }[],
  articles: { slug: string; title: string; summary: string | null }[],
): string;

export declare function articleDetailBody(article: {
  title: string;
  summary: string | null;
  body: string;
  imageUrl: string | null;
}): string;

import type { SeoArticle } from "@workspace/seo-content";

export declare function seoArticlesIndexBody(
  articles: Pick<SeoArticle, "slug" | "title" | "cardDescription" | "readMinutes">[],
): string;

export declare function seoArticleBody(
  article: SeoArticle,
  relatedQuizzes?: { id: number; title: string; questionCount: number; difficulty: string }[],
  otherArticles?: Pick<SeoArticle, "slug" | "title">[],
): string;

export declare function seoArticleJsonLd(article: SeoArticle, domain: string): object;
