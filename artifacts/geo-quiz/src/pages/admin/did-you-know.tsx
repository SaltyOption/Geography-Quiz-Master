import { useState } from "react";
import { Link } from "wouter";
import {
  useListFactoids,
  useCreateFactoid,
  useUpdateFactoid,
  useDeleteFactoid,
  useListArticles,
  useUpdateArticle,
  useDeleteArticle,
  getListFactoidsQueryKey,
  getListArticlesQueryKey,
  type Factoid,
  type ArticleSummary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { renderMarkdown } from "@workspace/markdown";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Lightbulb,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MarkdownTextarea } from "@/components/MarkdownTextarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface FactoidForm {
  text: string;
  sourceLabel: string;
  sourceUrl: string;
  published: boolean;
}

const emptyFactoid: FactoidForm = {
  text: "",
  sourceLabel: "",
  sourceUrl: "",
  published: true,
};

function FactoidDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Factoid | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createFactoid = useCreateFactoid();
  const updateFactoid = useUpdateFactoid();
  const [form, setForm] = useState<FactoidForm>(emptyFactoid);

  // Sync form when the dialog opens for a different factoid.
  const [syncedId, setSyncedId] = useState<number | "new" | null>(null);
  const key = editing ? editing.id : "new";
  if (open && syncedId !== key) {
    setForm(
      editing
        ? {
            text: editing.text,
            sourceLabel: editing.sourceLabel ?? "",
            sourceUrl: editing.sourceUrl ?? "",
            published: editing.published,
          }
        : emptyFactoid,
    );
    setSyncedId(key);
  }
  if (!open && syncedId !== null) setSyncedId(null);

  const isSaving = createFactoid.isPending || updateFactoid.isPending;

  const handleSave = async () => {
    const text = form.text.trim();
    if (!text) {
      toast({ title: "Fact text is required", variant: "destructive" });
      return;
    }
    const data = {
      text,
      sourceLabel: form.sourceLabel.trim() || null,
      sourceUrl: form.sourceUrl.trim() || null,
      published: form.published,
    };
    try {
      if (editing) {
        await updateFactoid.mutateAsync({ id: editing.id, data });
        toast({ title: "Fact updated" });
      } else {
        await createFactoid.mutateAsync({ data });
        toast({ title: "Fact created" });
      }
      queryClient.invalidateQueries({ queryKey: getListFactoidsQueryKey() });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to save fact",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit fact" : "New fact"}</DialogTitle>
          <DialogDescription>
            A short, surprising geography fact. Optionally add a source.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="factoid-text">Fact</Label>
            <MarkdownTextarea
              id="factoid-text"
              value={form.text}
              onChange={(text) => setForm((f) => ({ ...f, text }))}
              rows={4}
              placeholder="The Sahara Desert is roughly the size of the United States."
              data-testid="input-factoid-text"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="factoid-source-label">Source label</Label>
              <Input
                id="factoid-source-label"
                value={form.sourceLabel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sourceLabel: e.target.value }))
                }
                placeholder="National Geographic"
                data-testid="input-factoid-source-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="factoid-source-url">Source URL</Label>
              <Input
                id="factoid-source-url"
                value={form.sourceUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sourceUrl: e.target.value }))
                }
                placeholder="https://…"
                data-testid="input-factoid-source-url"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.published}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, published: checked }))
              }
              data-testid="switch-factoid-published"
            />
            {form.published ? "Published" : "Draft"}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-factoid">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDidYouKnow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: factoids, isLoading: factoidsLoading } = useListFactoids();
  const { data: articles, isLoading: articlesLoading } = useListArticles();
  const deleteFactoid = useDeleteFactoid();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFactoid, setEditingFactoid] = useState<Factoid | null>(null);
  const [togglingArticleId, setTogglingArticleId] = useState<number | null>(null);

  const openNewFactoid = () => {
    setEditingFactoid(null);
    setDialogOpen(true);
  };
  const openEditFactoid = (f: Factoid) => {
    setEditingFactoid(f);
    setDialogOpen(true);
  };

  const handleDeleteFactoid = async (id: number) => {
    try {
      await deleteFactoid.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListFactoidsQueryKey() });
      toast({ title: "Fact deleted" });
    } catch (error) {
      toast({ title: "Failed to delete fact", variant: "destructive" });
    }
  };

  const handleToggleArticle = async (article: ArticleSummary, published: boolean) => {
    setTogglingArticleId(article.id);
    try {
      await updateArticle.mutateAsync({ id: article.id, data: { published } });
      queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
      toast({ title: published ? "Article published" : "Article moved to draft" });
    } catch (error) {
      toast({ title: "Failed to update visibility", variant: "destructive" });
    } finally {
      setTogglingArticleId(null);
    }
  };

  const handleDeleteArticle = async (id: number) => {
    try {
      await deleteArticle.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
      toast({ title: "Article deleted" });
    } catch (error) {
      toast({ title: "Failed to delete article", variant: "destructive" });
    }
  };

  const factoidList = factoids ?? [];
  const articleList = articles ?? [];

  return (
    <div className="container max-w-5xl py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Did You Know</h1>
          <p className="mt-1 text-muted-foreground">
            Manage quick facts and long-form articles.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">← Back to Dashboard</Link>
        </Button>
      </div>

      {/* Factoids */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Lightbulb className="h-6 w-6 text-secondary" /> Quick Facts
          </h2>
          <Button onClick={openNewFactoid} data-testid="button-new-factoid">
            <Plus className="mr-2 h-4 w-4" /> New Fact
          </Button>
        </div>

        {factoidsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : factoidList.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No facts yet. Create your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {factoidList.map((f) => (
              <Card key={f.id} className="p-4" data-testid={`row-factoid-${f.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {!f.published && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          Draft
                        </Badge>
                      )}
                    </div>
                    <div
                      className="prose prose-stone max-w-none text-foreground prose-a:text-primary [&>p]:m-0"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(f.text) }}
                    />
                    {(f.sourceLabel || f.sourceUrl) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {f.sourceUrl ? (
                          <a
                            href={f.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {f.sourceLabel || f.sourceUrl}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          f.sourceLabel
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditFactoid(f)}
                      data-testid={`button-edit-factoid-${f.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this fact?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteFactoid(f.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Articles */}
      <section>
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BookOpen className="h-6 w-6 text-primary" /> Articles
          </h2>
          <Button asChild data-testid="button-new-article">
            <Link href="/admin/did-you-know/articles/new">
              <Plus className="mr-2 h-4 w-4" /> New Article
            </Link>
          </Button>
        </div>

        {articlesLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : articleList.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No articles yet. Write your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {articleList.map((a) => (
              <Card key={a.id} className="p-4" data-testid={`row-article-${a.id}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{a.title}</h3>
                      {!a.published && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          Draft
                        </Badge>
                      )}
                    </div>
                    {a.summary && (
                      <p className="line-clamp-1 max-w-2xl text-sm text-muted-foreground">
                        {a.summary}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">/did-you-know/{a.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="mr-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={a.published}
                        disabled={togglingArticleId === a.id}
                        onCheckedChange={(checked) => handleToggleArticle(a, checked)}
                        aria-label="Toggle published"
                      />
                      {a.published ? "Published" : "Draft"}
                    </label>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/did-you-know/articles/${a.id}`}>
                        <Edit2 className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{a.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the article. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteArticle(a.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <FactoidDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingFactoid}
      />
    </div>
  );
}
