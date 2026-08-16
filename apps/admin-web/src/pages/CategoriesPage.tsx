import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCategories, type Category } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CATEGORY_WRITE_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryDialog } from "@/components/CategoryDialog";

interface CategoryNode extends Category {
  depth: number;
}

function buildTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of categories) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    );
  }

  const result: CategoryNode[] = [];
  const visited = new Set<string>();
  function walk(parentId: string | null, depth: number) {
    for (const c of byParent.get(parentId) ?? []) {
      if (visited.has(c.id)) continue;
      visited.add(c.id);
      result.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

export function CategoriesPage() {
  const { accessToken, hasRole } = useAuth();
  const canWrite = hasRole(CATEGORY_WRITE_ROLES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(accessToken),
  });

  const tree = buildTree(categoriesQuery.data ?? []);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ангилал</h1>
          <p className="text-sm text-muted-foreground">
            Каталогийн ангиллын эцэг-хүүхэд бүтэц.
          </p>
        </div>
        {canWrite && <Button onClick={openCreate}>Ангилал нэмэх</Button>}
      </div>

      <Card>
        <CardContent>
          {categoriesQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {categoriesQuery.isError && (
            <p className="text-sm text-destructive">
              Ангилал татахад алдаа гарлаа.
            </p>
          )}
          {categoriesQuery.isSuccess && tree.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Одоогоор ангилал бүртгэгдээгүй байна.
            </p>
          )}
          <ul className="divide-y divide-border">
            {tree.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-2.5"
                style={{ paddingLeft: `${c.depth * 1.5}rem` }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {c.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    /{c.slug}
                  </span>
                  {!c.isActive && (
                    <Badge variant="secondary">Идэвхгүй</Badge>
                  )}
                </div>
                {canWrite && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(c)}
                  >
                    Засах
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {canWrite && (
        <CategoryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          category={editing}
          allCategories={categoriesQuery.data ?? []}
        />
      )}
    </div>
  );
}
