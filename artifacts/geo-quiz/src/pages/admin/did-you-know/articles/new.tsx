import { Link, useLocation } from "wouter";
import {
  useCreateArticle,
  getListArticlesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArticleForm, type ArticleFormValues } from "@/components/ArticleForm";

export default function AdminCreateArticle() {
  const [, setLocation] = useLocation();
  const createArticle = useCreateArticle();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const onSubmit = async (values: ArticleFormValues) => {
    try {
      await createArticle.mutateAsync({
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
      toast({ title: "Article created" });
      setLocation("/admin/did-you-know");
    } catch (error) {
      toast({
        title: "Failed to create article",
        description: error instanceof Error ? error.message : undefined,
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
          <CardTitle className="text-2xl">New Article</CardTitle>
          <CardDescription>
            Write a long-form geography article. It appears on the Did You Know page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArticleForm
            defaultValues={{
              title: "",
              slug: "",
              summary: "",
              body: "",
              imageUrl: "",
              published: false,
            }}
            onSubmit={onSubmit}
            submitting={createArticle.isPending}
            submitLabel="Create Article"
          />
        </CardContent>
      </Card>
    </div>
  );
}
