import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getCategories,
  getProducts,
  searchProducts,
  type Product,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { PRODUCT_CREATE_ROLES, PRODUCT_UPDATE_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductDialog } from "@/components/ProductDialog";

const ALL_CATEGORIES = "__all__";

export function ProductsPage() {
  const { accessToken, hasRole } = useAuth();
  const canCreate = hasRole(PRODUCT_CREATE_ROLES);
  const canUpdate = hasRole(PRODUCT_UPDATE_ROLES);

  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [searchInput, setSearchInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // docs/plan.md §8 Phase 2 Хэсэг B, даалгавар #11: debounce-той хайлтын
  // талбар, GET /catalog/search дуудна. Хоосон бол энгийн ангилалаар
  // шүүсэн GET /products жагсаалт руу буцна.
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const isSearching = debouncedSearch.length > 0;
  const activeCategoryId =
    categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter;

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(accessToken),
  });

  const productsQuery = useQuery({
    queryKey: ["products", activeCategoryId],
    queryFn: () => getProducts(accessToken, activeCategoryId),
    enabled: !isSearching,
  });

  const searchResultsQuery = useQuery({
    queryKey: ["catalog-search", debouncedSearch, activeCategoryId],
    queryFn: () =>
      searchProducts(accessToken, {
        q: debouncedSearch,
        categoryId: activeCategoryId,
      }),
    enabled: isSearching,
  });

  const listQuery = isSearching ? searchResultsQuery : productsQuery;

  const categoryNameById = new Map(
    (categoriesQuery.data ?? []).map((c) => [c.id, c.name]),
  );

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Бүтээгдэхүүн
          </h1>
          <p className="text-sm text-muted-foreground">
            Ангиллаар шүүж, хувилбар/нөөцийн дэлгэрэнгүй рүү шилжинэ.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>Бүтээгдэхүүн нэмэх</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Бүх ангилал</SelectItem>
              {(categoriesQuery.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-xs">
          <Input
            placeholder="Нэрээр хайх…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent>
          {listQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {listQuery.isError && (
            <p className="text-sm text-destructive">
              Бүтээгдэхүүн татахад алдаа гарлаа.
            </p>
          )}
          {listQuery.isSuccess && listQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {isSearching
                ? "Хайлтад тохирох бүтээгдэхүүн олдсонгүй."
                : "Бүтээгдэхүүн олдсонгүй."}
            </p>
          )}
          <ul className="divide-y divide-border">
            {(listQuery.data ?? []).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {p.name}
                    </span>
                    {!p.isActive && (
                      <Badge variant="secondary">Идэвхгүй</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {categoryNameById.get(p.categoryId) ?? "—"}
                    {p.brand ? ` · ${p.brand}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canUpdate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(p)}
                    >
                      Засах
                    </Button>
                  )}
                  <Button asChild variant="secondary" size="sm">
                    <Link to={`/products/${p.id}`}>Дэлгэрэнгүй</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {(canCreate || canUpdate) && (
        <ProductDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          product={editing}
          categories={categoriesQuery.data ?? []}
        />
      )}
    </div>
  );
}
