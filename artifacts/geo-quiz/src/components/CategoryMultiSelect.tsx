import { useGetCategoryTree, type CategoryNode } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

function flattenNode(node: CategoryNode, depth: number): { node: CategoryNode; depth: number }[] {
  return [{ node, depth }, ...node.children.flatMap((c) => flattenNode(c, depth + 1))];
}

export function CategoryMultiSelect({ selectedIds, onChange }: Props) {
  const { data: tree, isLoading } = useGetCategoryTree();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted/30 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        No categories yet. Create them in the Categories admin page first.
      </div>
    );
  }

  const flat = tree.flatMap((n) => flattenNode(n, 0));
  const selectedSet = new Set(selectedIds);

  const toggle = (id: number) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-2">
      <div className="max-h-64 overflow-y-auto rounded-md border bg-card p-2">
        {flat.map(({ node, depth }) => {
          const isLeaf = node.children.length === 0;
          const checked = selectedSet.has(node.id);
          return (
            <div
              key={node.id}
              className={`flex items-center gap-2 rounded-md py-1.5 pr-2 ${
                isLeaf ? "hover:bg-muted/60 cursor-pointer" : ""
              }`}
              style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
              onClick={isLeaf ? () => toggle(node.id) : undefined}
            >
              {isLeaf ? (
                <Checkbox
                  id={`cat-${node.id}`}
                  checked={checked}
                  onCheckedChange={() => toggle(node.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="block h-4 w-4" />
              )}
              <Label
                htmlFor={isLeaf ? `cat-${node.id}` : undefined}
                className={isLeaf ? "flex-1 cursor-pointer text-sm font-normal" : "flex-1 text-sm font-semibold text-muted-foreground"}
                onClick={(e) => e.stopPropagation()}
              >
                {node.name}
              </Label>
            </div>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flat
            .filter(({ node }) => selectedSet.has(node.id))
            .map(({ node }) => (
              <Badge key={node.id} variant="secondary" className="text-xs">
                {node.name}
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
