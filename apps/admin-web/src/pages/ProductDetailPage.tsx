import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBranches, getProduct, type ProductVariant } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  INVENTORY_WRITE_ROLES,
  VARIANT_CREATE_ROLES,
  VARIANT_UPDATE_ROLES,
} from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { InventoryPanel } from "@/components/InventoryPanel";
import { VariantDialog } from "@/components/VariantDialog";
import { cn } from "@/lib/utils";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, hasRole } = useAuth();
  const canCreateVariant = hasRole(VARIANT_CREATE_ROLES);
  const canUpdateVariant = hasRole(VARIANT_UPDATE_ROLES);
  const canWriteInventory = hasRole(INVENTORY_WRITE_ROLES);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    null,
  );
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null,
  );

  const branchesQuery = useQuery({
    queryKey: ["branches", accessToken],
    queryFn: () => getBranches(accessToken),
  });

  useEffect(() => {
    if (!selectedBranchId && branchesQuery.data && branchesQuery.data.length > 0) {
      setSelectedBranchId(branchesQuery.data[0].id);
    }
  }, [branchesQuery.data, selectedBranchId]);

  const productQuery = useQuery({
    queryKey: ["product", id, selectedBranchId],
    queryFn: () => getProduct(accessToken, id as string, selectedBranchId ?? undefined),
    enabled: !!id,
  });

  useEffect(() => {
    if (!selectedVariantId && productQuery.data?.variants.length) {
      setSelectedVariantId(productQuery.data.variants[0].id);
    }
  }, [productQuery.data, selectedVariantId]);

  const selectedVariant =
    productQuery.data?.variants.find((v) => v.id === selectedVariantId) ??
    null;

  function openCreateVariant() {
    setEditingVariant(null);
    setVariantDialogOpen(true);
  }

  function openEditVariant(v: ProductVariant) {
    setEditingVariant(v);
    setVariantDialogOpen(true);
  }

  if (productQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>;
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <p className="text-sm text-destructive">
        Бүтээгдэхүүн олдсонгүй эсвэл татахад алдаа гарлаа.
      </p>
    );
  }

  const product = productQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/products"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Бүтээгдэхүүн рүү буцах
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {product.name}
          </h1>
          {!product.isActive && <Badge variant="secondary">Идэвхгүй</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {product.brand ? `${product.brand} · ` : ""}
          {product.slug}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Хувилбарууд</CardTitle>
          {canCreateVariant && (
            <Button size="sm" onClick={openCreateVariant}>
              Хувилбар нэмэх
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {product.variants.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Хувилбар бүртгэгдээгүй байна.
            </p>
          )}
          <ul className="divide-y divide-border">
            {product.variants.map((v) => (
              <li key={v.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedVariantId(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedVariantId(v.id);
                    }
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left transition-colors",
                    selectedVariantId === v.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {v.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {v.sku}
                    </span>
                    {!v.isActive && (
                      <Badge variant="secondary">Идэвхгүй</Badge>
                    )}
                    <AvailabilityBadge {...v.availability} />
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm">
                      {Number(v.basePrice).toLocaleString("mn-MN")}₮
                    </span>
                    {canUpdateVariant && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditVariant(v);
                        }}
                      >
                        Засах
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {selectedVariant && (
        <Card>
          <CardHeader>
            <CardTitle>Агуулах — {selectedVariant.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryPanel
              variant={selectedVariant}
              branches={branchesQuery.data ?? []}
              selectedBranchId={selectedBranchId}
              onBranchChange={setSelectedBranchId}
              canWrite={canWriteInventory}
            />
          </CardContent>
        </Card>
      )}

      {(canCreateVariant || canUpdateVariant) && (
        <VariantDialog
          open={variantDialogOpen}
          onOpenChange={setVariantDialogOpen}
          productId={product.id}
          variant={editingVariant}
        />
      )}
    </div>
  );
}
