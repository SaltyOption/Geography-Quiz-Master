export declare const META_DESCRIPTIONS: Record<string, string>;

export declare function getMetaDescription(
  path: string | null | undefined,
): string | undefined;

export interface SeoArticleFaq {
  question: string;
  answer: string;
}

export interface SeoArticleCtaButton {
  label: string;
  href: string;
}

export interface SeoArticleCta {
  heading: string;
  text: string;
  buttons: SeoArticleCtaButton[];
}

export interface SeoArticle {
  slug: string;
  title: string;
  tag: string;
  metaDescription: string;
  keywords: string[];
  illustration: string;
  illustrationAlt: string;
  cardDescription: string;
  publishedLabel: string;
  datePublished: string;
  readMinutes: number;
  body: string;
  faqs: SeoArticleFaq[];
  cta: SeoArticleCta;
  relatedQuizIds: number[];
}

export declare const SEO_ARTICLES: SeoArticle[];

export declare function getSeoArticle(slug: string): SeoArticle | undefined;
