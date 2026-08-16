import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adjustInventoryQuantity,
  getBranches,
  getInventoryItems,
  getProductVariants,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { INVENTORY_WRITE_ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuantityAdjuster } from "@/components/QuantityAdjuster";

// Салбарын нөөцийн бүх мөрийг нэг дороос харах ерөнхий тойм — дэлгэрэнгүй
// (branchPrice/preOrder override гэх мэт) засварыг /products/:id рүү
// орж хийнэ (InventoryPanel), энд зөвхөн quantity delta + доод хязгаарын
// сэрэмжлүүлэг.
export function InventoryPage() {
  const { accessToken, hasRole } = useAuth();
  const canWrite = hasRole(INVENTORY_WRITE_ROLES);
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState<string | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["branches", accessToken],
    queryFn: () => getBranches(accessToken),
  });

  useEffect(() => {
    if (!branchId && branchesQuery.data && branchesQuery.data.length > 0) {
      setBranchId(branchesQuery.data[0].id);
    }
  }, [branchesQuery.data, branchId]);

  const itemsQuery = useQuery({
    queryKey: ["inventory-items", branchId],
    queryFn: () => getInventoryItems(accessToken, { branchId: branchId ?? undefined }),
    enabled: !!branchId,
  });

  const variantsQuery = useQuery({
    queryKey: ["product-variants-all"],
    queryFn: () => getProductVariants(accessToken),
  });

  const variantById = new Map((variantsQuery.data ?? []).map((v) => [v.id, v]));

  const adjustMutation = useMutation({
    mutationFn: (vars: { id: string; delta: number }) =>
      adjustInventoryQuantity(accessToken, vars.id, vars.delta),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory-items", branchId] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Агуулах</h1>
        <p className="text-sm text-muted-foreground">
          Сонгосон салбарын бүх нөөцийн мөр, доод хязгаарын сэрэмжлүүлэг.
        </p>
      </div>

      {branchesQuery.data && branchesQuery.data.length > 1 && (
        <div className="w-full max-w-xs">
          <Select value={branchId ?? undefined} onValueChange={setBranchId}>
            <SelectTrigger className="w-full" aria-label="Салбар сонгох">
              <SelectValue placeholder="Салбар сонгох" />
            </SelectTrigger>
            <SelectContent>
              {branchesQuery.data.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardContent>
          {!branchesQuery.isLoading &&
            (branchesQuery.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Танд хандах эрхтэй салбар алга.
              </p>
            )}

          {itemsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {itemsQuery.isError && (
            <p className="text-sm text-destructive">
              Нөөцийн мэдээлэл татахад алдаа гарлаа (эрхээ шалгана уу).
            </p>
          )}
          {itemsQuery.isSuccess && itemsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Энэ салбарт нөөцийн бүртгэл алга.
            </p>
          )}

          <ul className="divide-y divide-border">
            {(itemsQuery.data ?? []).map((item) => {
              const variant = variantById.get(item.variantId);
              const isLowStock = item.quantity < item.lowStockThreshold;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {variant ? (
                      <Link
                        to={`/products/${variant.productId}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {variant.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">
                        (Хувилбар олдсонгүй)
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {variant?.sku ?? item.variantId}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isLowStock && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300">
                        Дутагдалтай
                      </Badge>
                    )}
                    {canWrite ? (
                      <QuantityAdjuster
                        currentQuantity={item.quantity}
                        onAdjust={(delta) =>
                          adjustMutation.mutate({ id: item.id, delta })
                        }
                        disabled={adjustMutation.isPending}
                      />
                    ) : (
                      <span className="text-sm">
                        Үлдэгдэл:{" "}
                        <span className="font-medium">{item.quantity}</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
