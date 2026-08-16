import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createProductVariant,
  updateProductVariant,
  type ProductVariant,
  type ProductVariantInput,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  variant: ProductVariant | null;
}

export function VariantDialog({
  open,
  onOpenChange,
  productId,
  variant,
}: VariantDialogProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = variant !== null;

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [preOrderEnabled, setPreOrderEnabled] = useState(false);
  const [preOrderLeadDays, setPreOrderLeadDays] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(variant?.name ?? "");
    setSku(variant?.sku ?? "");
    setUnit(variant?.unit ?? "ширхэг");
    setBasePrice(variant?.basePrice ?? "");
    setCostPrice(variant?.costPrice ?? "");
    setBarcode(variant?.barcode ?? "");
    setIsActive(variant?.isActive ?? true);
    setPreOrderEnabled(variant?.defaultPreOrderEnabled ?? false);
    setPreOrderLeadDays(
      variant?.defaultPreOrderLeadDays != null
        ? String(variant.defaultPreOrderLeadDays)
        : "",
    );
  }, [open, variant]);

  const mutation = useMutation({
    mutationFn: () => {
      const dto: ProductVariantInput = {
        productId,
        name,
        sku,
        unit: unit || undefined,
        basePrice: Number(basePrice),
        costPrice: costPrice ? Number(costPrice) : undefined,
        barcode: barcode || undefined,
        isActive,
        defaultPreOrderEnabled: preOrderEnabled,
        defaultPreOrderLeadDays: preOrderEnabled
          ? Number(preOrderLeadDays || 0)
          : undefined,
      };
      return isEdit
        ? updateProductVariant(accessToken, variant.id, dto)
        : createProductVariant(accessToken, dto);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product", productId] });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Хувилбар засах" : "Шинэ хувилбар"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Хувилбарын мэдээллийг шинэчилнэ."
              : "Бүтээгдэхүүнд шинэ хувилбар (жиш: хэмжээ, өнгө) нэмнэ."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="variant-name">Нэр (жиш: "XL, хар")</Label>
            <Input
              id="variant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={mutation.isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="variant-sku">SKU</Label>
              <Input
                id="variant-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="variant-unit">Нэгж</Label>
              <Input
                id="variant-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="variant-base-price">Үндсэн үнэ (₮)</Label>
              <Input
                id="variant-base-price"
                type="number"
                min={0}
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="variant-cost-price">Өртөг (₮)</Label>
              <Input
                id="variant-cost-price"
                type="number"
                min={0}
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="variant-barcode">Баркод</Label>
            <Input
              id="variant-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="variant-preorder">
                Анхдагч: захиалгаар авах боломжтой
              </Label>
              <Switch
                id="variant-preorder"
                checked={preOrderEnabled}
                onCheckedChange={setPreOrderEnabled}
                disabled={mutation.isPending}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Салбар тус бүр InventoryItem дээрээ энэ утгыг дарж бичиж
              (override) болно.
            </p>
            {preOrderEnabled && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="variant-lead-days">Хүлээх хугацаа (өдөр)</Label>
                <Input
                  id="variant-lead-days"
                  type="number"
                  min={0}
                  step={1}
                  value={preOrderLeadDays}
                  onChange={(e) => setPreOrderLeadDays(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="variant-active">Идэвхтэй</Label>
            <Switch
              id="variant-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={mutation.isPending}
            />
          </div>

          {mutation.isError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Тодорхойгүй алдаа гарлаа"}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Болих
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
