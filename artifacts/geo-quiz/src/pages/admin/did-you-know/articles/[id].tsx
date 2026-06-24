import { Link, useLocation, useParams } from "wouter";
import {
  useGetArticle,
  useUpdateArticle,
  getListArticlesQueryKey,
  getGetArticleQueryKey,
  getGetArticleBySlugQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArticleForm, type ArticleFormValues } from "@/components/ArticleForm";

export default function AdminEditArticle() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: article, isLoading, error } = useGetArticle(id, {
    query: { enabled: Number.isFinite(id), queryKey: getGetArticleQueryKey(id) },
  });
  const updateArticle = useUpdateArticle();

  const onSubmit = async (values: ArticleFormValues) => {
    if (!article) return;
    try {
      const updated = await updateArticle.mutateAsync({
        id: article.id,
        data: {
          title: values.title.trim(),
          ...(values.slug?.trim() ? { slug: values.slug.trim() } : {}),
          summary: values.summary?.trim() ? values.summary.trim() : null,
          body: values.body,
          imageUrl: values.imageUrl?.trim() ? values.imageUrl.trim() : null,
          published: values.published,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetArticleQueryKey(article.id) });
      queryClient.invalidateQueries({
        queryKey: getGetArticleBySlugQueryKey(article.slug),
      });
      if (updated.slug !== article.slug) {
        queryClient.invalidateQueries({
          queryKey: getGetArticleBySlugQueryKey(updated.slug),
        });
      }
      toast({ title: "Article saved" });
      setLocation("/admin/did-you-know");
    } catch (err) {
      toast({
        title: "Failed to save article",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-3xl py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
        <Link href="/admin/did-you-know">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Did You Know
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Edit Article</CardTitle>
          <CardDescription>Update this article's content and visibility.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error || !article ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>Article not found.</p>
              <Button asChild className="mt-4">
                <Link href="/admin/did-you-know">Back to Did You Know</Link>
              </Button>
            </div>
          ) : (
            <ArticleForm
              showSlug
              defaultValues={{
                title: article.title,
                slug: article.slug,
                summary: article.summary ?? "",
                body: article.body,
                imageUrl: article.imageUrl ?? "",
                published: article.published,
              }}
              onSubmit={onSubmit}
              submitting={updateArticle.isPending}
              submitLabel="Save Changes"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
