import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  adjustInventoryQuantity,
  createInventoryItem,
  getInventoryItems,
  updateInventoryItem,
  type Branch,
  type InventoryItem,
  type ProductVariantWithAvailability,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { QuantityAdjuster } from "@/components/QuantityAdjuster";
import { OverrideField } from "@/components/OverrideField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InventoryPanelProps {
  variant: ProductVariantWithAvailability;
  branches: Branch[];
  selectedBranchId: string | null;
  onBranchChange: (branchId: string) => void;
  canWrite: boolean;
}

// §5 (Бүтээгдэхүүний дэлгэрэнгүй) даалгаврын нөөцийн засварлах хэсэг:
// салбар сонгох, quantity delta, threshold сэрэмжлүүлэг, branchPrice/
// preOrder override toggle-ууд, тооцоолсон availability badge.
export function InventoryPanel({
  variant,
  branches,
  selectedBranchId,
  onBranchChange,
  canWrite,
}: InventoryPanelProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const itemQuery = useQuery({
    queryKey: ["inventory-item", variant.id, selectedBranchId],
    queryFn: () =>
      getInventoryItems(accessToken, {
        variantId: variant.id,
        branchId: selectedBranchId ?? undefined,
      }),
    enabled: !!selectedBranchId,
    retry: false,
  });

  const item: InventoryItem | null = itemQuery.data?.[0] ?? null;
  const forbidden =
    itemQuery.error instanceof ApiError && itemQuery.error.status === 403;

  const [threshold, setThreshold] = useState("5");
  const [priceOverrideEnabled, setPriceOverrideEnabled] = useState(false);
  const [branchPrice, setBranchPrice] = useState("");
  const [preOrderOverrideEnabled, setPreOrderOverrideEnabled] = useState(false);
  const [preOrderEnabled, setPreOrderEnabled] = useState(false);
  const [preOrderLeadDays, setPreOrderLeadDays] = useState("");

  useEffect(() => {
    if (!item) return;
    setThreshold(String(item.lowStockThreshold));
    setPriceOverrideEnabled(item.branchPrice != null);
    setBranchPrice(item.branchPrice ?? "");
    setPreOrderOverrideEnabled(item.preOrderEnabledOverride != null);
    setPreOrderEnabled(item.preOrderEnabledOverride ?? false);
    setPreOrderLeadDays(
      item.preOrderLeadDaysOverride != null
        ? String(item.preOrderLeadDaysOverride)
        : "",
    );
  }, [item]);

  function invalidateAll() {
    void queryClient.invalidateQueries({
      queryKey: ["inventory-item", variant.id, selectedBranchId],
    });
    void queryClient.invalidateQueries({ queryKey: ["product"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createInventoryItem(accessToken, {
        variantId: variant.id,
        branchId: selectedBranchId as string,
        quantity: 0,
      }),
    onSuccess: invalidateAll,
  });

  const adjustMutation = useMutation({
    mutationFn: (delta: number) =>
      adjustInventoryQuantity(accessToken, (item as InventoryItem).id, delta),
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateInventoryItem(accessToken, (item as InventoryItem).id, {
        lowStockThreshold: Number(threshold),
        branchPrice: priceOverrideEnabled ? Number(branchPrice) : null,
        preOrderEnabledOverride: preOrderOverrideEnabled
          ? preOrderEnabled
          : null,
        preOrderLeadDaysOverride: preOrderOverrideEnabled
          ? Number(preOrderLeadDays || 0)
          : null,
      }),
    onSuccess: invalidateAll,
  });

  const isLowStock = item != null && item.quantity < item.lowStockThreshold;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {branches.length > 1 && (
          <Select
            value={selectedBranchId ?? undefined}
            onValueChange={onBranchChange}
          >
            <SelectTrigger className="w-56" aria-label="Салбар сонгох">
              <SelectValue placeholder="Салбар сонгох" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <AvailabilityBadge {...variant.availability} />
      </div>

      {itemQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
      )}

      {forbidden && (
        <p className="text-sm text-muted-foreground">
          Танд энэ салбарын нөөцийн дэлгэрэнгүйг харах эрх байхгүй.
        </p>
      )}

      {!forbidden && !itemQuery.isLoading && !item && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Энэ салбарт нөөцийн бүртгэл алга.
          </p>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !selectedBranchId}
            >
              {createMutation.isPending ? "Нэмж байна…" : "Бүртгэл нэмэх"}
            </Button>
          )}
        </div>
      )}

      {item && (
        <div className="space-y-4">
          {isLowStock && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Үлдэгдэл доод хязгаараас ({item.lowStockThreshold}) доогуур
              байна!
            </p>
          )}

          {canWrite ? (
            <QuantityAdjuster
              currentQuantity={item.quantity}
              onAdjust={(delta) => adjustMutation.mutate(delta)}
              disabled={adjustMutation.isPending}
            />
          ) : (
            <p className="text-sm">
              Одоогийн үлдэгдэл:{" "}
              <span className="font-medium">{item.quantity}</span>
            </p>
          )}

          {canWrite ? (
            <div className="max-w-sm space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="low-stock-threshold">
                  Доод хязгаар (сэрэмжлүүлэг)
                </Label>
                <Input
                  id="low-stock-threshold"
                  type="number"
                  min={0}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>

              <OverrideField
                label="Салбарын тусгай үнэ"
                hint="Унтраасан бол бүтээгдэхүүний үндсэн үнийг ашиглана."
                enabled={priceOverrideEnabled}
                onEnabledChange={setPriceOverrideEnabled}
              >
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={branchPrice}
                  onChange={(e) => setBranchPrice(e.target.value)}
                  placeholder="Салбарын үнэ (₮)"
                  aria-label="Салбарын үнэ"
                />
              </OverrideField>

              <OverrideField
                label="Захиалгаар авах боломж (тусгай)"
                hint="Унтраасан бол бүтээгдэхүүний анхдагч тохиргоог өвлөнө."
                enabled={preOrderOverrideEnabled}
                onEnabledChange={setPreOrderOverrideEnabled}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Захиалгаар авах боломжтой</Label>
                    <Switch
                      checked={preOrderEnabled}
                      onCheckedChange={setPreOrderEnabled}
                      aria-label="Захиалгаар авах боломжтой"
                    />
                  </div>
                  {preOrderEnabled && (
                    <Input
                      type="number"
                      min={0}
                      value={preOrderLeadDays}
                      onChange={(e) => setPreOrderLeadDays(e.target.value)}
                      placeholder="Хүлээх хугацаа (өдөр)"
                      aria-label="Хүлээх хугацаа"
                    />
                  )}
                </div>
              </OverrideField>

              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? "Хадгалж байна…"
                  : "Тохиргоо хадгалах"}
              </Button>
            </div>
          ) : (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Доод хязгаар: {item.lowStockThreshold}</p>
              <p>
                Салбарын үнэ:{" "}
                {item.branchPrice ?? "— (үндсэн үнэ ашиглана)"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
