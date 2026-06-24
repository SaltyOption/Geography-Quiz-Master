import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { renderMarkdown } from "@workspace/markdown";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const articleFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  slug: z.string().max(200).optional(),
  summary: z.string().max(500).optional(),
  body: z.string().min(1, "Body cannot be empty"),
  imageUrl: z.string().max(500).optional(),
  published: z.boolean(),
});

export type ArticleFormValues = z.infer<typeof articleFormSchema>;

export function ArticleForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  showSlug = false,
}: {
  defaultValues: ArticleFormValues;
  onSubmit: (values: ArticleFormValues) => void | Promise<void>;
  submitting: boolean;
  submitLabel: string;
  showSlug?: boolean;
}) {
  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleFormSchema),
    defaultValues,
  });

  const imageUrl = form.watch("imageUrl");
  const body = form.watch("body");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="The hidden rivers beneath the Sahara" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showSlug && (
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input placeholder="hidden-rivers-sahara" {...field} />
                </FormControl>
                <FormDescription>
                  The URL is /did-you-know/&lt;slug&gt;. Leave blank to auto-generate from the title.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="A short teaser shown on cards and used for SEO/social previews."
                  className="h-20 resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>Optional. Shown on the listing and in link previews.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cover image URL</FormLabel>
              <FormControl>
                <Input placeholder="https://… or /landmarks/…" {...field} />
              </FormControl>
              <FormDescription>
                Optional. A full https URL or a hosted path. Hosted /regions/ or /landmarks/
                paths must have their responsive variants uploaded.
              </FormDescription>
              {imageUrl && (
                <div className="mt-2 overflow-hidden rounded-lg border bg-muted">
                  <img
                    src={imageUrl}
                    alt="Cover preview"
                    className="max-h-48 w-full object-cover"
                  />
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Body</FormLabel>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormControl>
                  <Textarea
                    placeholder={
                      "Write the article in Markdown.\n\n## A heading\n\nUse **bold**, *italic*, `code`, [links](https://example.com), and\n- bullet lists\n- like this"
                    }
                    className="min-h-[320px] font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <div className="min-h-[320px] overflow-auto rounded-md border bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Preview
                  </p>
                  {body ? (
                    <div
                      className="prose prose-stone max-w-none prose-headings:font-bold prose-a:text-primary"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your formatted article will appear here as you type.
                    </p>
                  )}
                </div>
              </div>
              <FormDescription>
                Markdown supported: headings (#, ##, ###), **bold**, *italic*, `code`,
                [links](url), and bullet/numbered lists.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="published"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Published</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Off keeps this article as a draft, hidden from visitors.
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4 border-t pt-4">
          <Button variant="outline" asChild type="button">
            <Link href="/admin/did-you-know">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting} data-testid="button-save-article">
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
