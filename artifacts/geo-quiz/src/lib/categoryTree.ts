import type { CategoryNode } from "@workspace/api-client-react";

export function flattenCategoryTree(
  nodes: CategoryNode[],
  depth = 0
): { id: number; name: string; depth: number }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flattenCategoryTree(n.children, depth + 1),
  ]);
}
