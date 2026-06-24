import { useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Save,
  Loader2,
  Bold,
  Italic,
  Heading,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
} from "lucide-react";
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

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function setBody(next: string, selStart: number, selEnd: number) {
    form.setValue("body", next, { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      const ta = bodyRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  }

  function applyInline(prefix: string, suffix: string, placeholder: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    const selStart = start + prefix.length;
    setBody(next, selStart, selStart + selected.length);
  }

  function applyLink() {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const label = value.slice(start, end) || "label";
    const urlPlaceholder = "https://example.com";
    const next =
      value.slice(0, start) + `[${label}](${urlPlaceholder})` + value.slice(end);
    const urlStart = start + label.length + 3;
    setBody(next, urlStart, urlStart + urlPlaceholder.length);
  }

  function handleBodyKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      applyInline("**", "**", "bold text");
    } else if (key === "i") {
      event.preventDefault();
      applyInline("*", "*", "italic text");
    } else if (key === "k") {
      event.preventDefault();
      applyLink();
    }
  }

  function applyLinePrefix(getPrefix: (index: number) => string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = value.length;
    const newBlock = value
      .slice(lineStart, lineEnd)
      .split("\n")
      .map((line, index) => getPrefix(index) + line)
      .join("\n");
    const next = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    setBody(next, lineStart, lineStart + newBlock.length);
  }

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
              <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Bold"
                  aria-label="Bold"
                  data-testid="button-format-bold"
                  onClick={() => applyInline("**", "**", "bold text")}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Italic"
                  aria-label="Italic"
                  data-testid="button-format-italic"
                  onClick={() => applyInline("*", "*", "italic text")}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Heading"
                  aria-label="Heading"
                  data-testid="button-format-heading"
                  onClick={() => applyLinePrefix(() => "## ")}
                >
                  <Heading className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Inline code"
                  aria-label="Inline code"
                  data-testid="button-format-code"
                  onClick={() => applyInline("`", "`", "code")}
                >
                  <Code className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Link"
                  aria-label="Link"
                  data-testid="button-format-link"
                  onClick={applyLink}
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Bullet list"
                  aria-label="Bullet list"
                  data-testid="button-format-bullet-list"
                  onClick={() => applyLinePrefix(() => "- ")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Numbered list"
                  aria-label="Numbered list"
                  data-testid="button-format-numbered-list"
                  onClick={() => applyLinePrefix((index) => `${index + 1}. `)}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormControl>
                  <Textarea
                    placeholder={
                      "Write the article in Markdown.\n\n## A heading\n\nUse **bold**, *italic*, `code`, [links](https://example.com), and\n- bullet lists\n- like this"
                    }
                    className="min-h-[320px] font-mono text-sm"
                    {...field}
                    onKeyDown={handleBodyKeyDown}
                    ref={(el) => {
                      field.ref(el);
                      bodyRef.current = el;
                    }}
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
