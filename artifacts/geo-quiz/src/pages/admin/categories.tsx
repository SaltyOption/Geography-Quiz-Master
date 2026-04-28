import { useState } from "react";
import { Link } from "wouter";
import {
  useGetCategoryTree,
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getGetCategoryTreeQueryKey,
  getListCategoriesQueryKey,
  getListQuizzesQueryKey,
  type CategoryNode,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const NO_PARENT = "__none__";

type EditState = { id: number; name: string; parentId: number | null };

function CategoryTreeNode({
  node,
  depth,
  expanded,
  toggle,
  editing,
  setEditing,
  onSave,
  onDelete,
  onAddChild,
  isSavingId,
  isDeletingId,
}: {
  node: CategoryNode;
  depth: number;
  expanded: Set<number>;
  toggle: (id: number) => void;
  editing: EditState | null;
  setEditing: (s: EditState | null) => void;
  onSave: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onAddChild: (parentId: number) => void;
  isSavingId: number | null;
  isDeletingId: number | null;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isEditing = editing?.id === node.id;

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md py-2 pr-2 hover:bg-muted/60"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() => hasChildren && toggle(node.id)}
          aria-label={hasChildren ? (isExpanded ? "Collapse" : "Expand") : undefined}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </button>

        {isEditing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="h-8 max-w-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave(node.id, editing.name);
                if (e.key === "Escape") setEditing(null);
              }}
            />
            <Button
              size="sm"
              onClick={() => onSave(node.id, editing.name)}
              disabled={isSavingId === node.id || editing.name.trim().length === 0}
            >
              {isSavingId === node.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <span className="flex-1 font-medium">{node.name}</span>
            <Badge variant="outline" className="text-xs">
              {node.quizCount} {node.quizCount === 1 ? "quiz" : "quizzes"}
            </Badge>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onAddChild(node.id)}
                title="Add child category"
                data-testid={`button-add-child-${node.id}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditing({ id: node.id, name: node.name, parentId: node.parentId })}
                title="Rename"
                data-testid={`button-rename-${node.id}`}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                    data-testid={`button-delete-${node.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{node.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Quizzes in this category will be unlinked from it.
                      {hasChildren && " Child categories will become top-level categories."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(node.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeletingId === node.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              editing={editing}
              setEditing={setEditing}
              onSave={onSave}
              onDelete={onDelete}
              onAddChild={onAddChild}
              isSavingId={isSavingId}
              isDeletingId={isDeletingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCategories() {
  const { data: tree, isLoading } = useGetCategoryTree();
  const { data: allCategories } = useListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<EditState | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string>(NO_PARENT);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCategoryTreeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
  };

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (name.length === 0) return;
    try {
      const parentId = newParentId === NO_PARENT ? null : parseInt(newParentId, 10);
      await createCategory.mutateAsync({ data: { name, parentId } });
      setNewName("");
      setNewParentId(NO_PARENT);
      if (parentId !== null) setExpanded((prev) => new Set(prev).add(parentId));
      invalidate();
      toast({ title: "Category created" });
    } catch {
      toast({ title: "Failed to create category", variant: "destructive" });
    }
  };

  const handleAddChild = async (parentId: number) => {
    const name = window.prompt("New child category name:");
    if (!name || name.trim().length === 0) return;
    try {
      await createCategory.mutateAsync({ data: { name: name.trim(), parentId } });
      setExpanded((prev) => new Set(prev).add(parentId));
      invalidate();
      toast({ title: "Category created" });
    } catch {
      toast({ title: "Failed to create category", variant: "destructive" });
    }
  };

  const handleSaveRename = async (id: number, name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setSavingId(id);
    try {
      await updateCategory.mutateAsync({ id, data: { name: trimmed } });
      setEditing(null);
      invalidate();
      toast({ title: "Category renamed" });
    } catch {
      toast({ title: "Failed to rename", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteCategory.mutateAsync({ id });
      invalidate();
      toast({ title: "Category deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container max-w-4xl py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>

      <div className="mb-8 flex items-center gap-3">
        <FolderTree className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1">
            Organize quizzes into a hierarchy. Each quiz can belong to multiple categories.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Add Category</CardTitle>
            <CardDescription>Create a new top-level or nested category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                placeholder="e.g. Asia"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-parent">Parent (optional)</Label>
              <Select value={newParentId} onValueChange={setNewParentId}>
                <SelectTrigger id="new-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>— Top level —</SelectItem>
                  {allCategories?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createCategory.isPending || newName.trim().length === 0}
            >
              {createCategory.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Category Tree</CardTitle>
            <CardDescription>Click a row to rename, add a child, or delete.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !tree || tree.length === 0 ? (
              <div className="rounded-lg border border-dashed py-12 text-center">
                <p className="text-muted-foreground">No categories yet. Add one to get started.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.map((node) => (
                  <CategoryTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    toggle={toggle}
                    editing={editing}
                    setEditing={setEditing}
                    onSave={handleSaveRename}
                    onDelete={handleDelete}
                    onAddChild={handleAddChild}
                    isSavingId={savingId}
                    isDeletingId={deletingId}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
