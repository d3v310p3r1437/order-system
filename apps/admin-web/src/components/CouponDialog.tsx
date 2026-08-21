import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCoupon,
  updateCoupon,
  type Coupon,
  type CouponDiscountType,
  type CouponInput,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: Coupon | null;
}

// <input type="datetime-local">-ийн шаардсан "YYYY-MM-DDTHH:mm" хэлбэрт
// (секунд/timezone-гүй, ХОРОНЛОГ цагийн бүсээр) хөрвүүлнэ.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultValidFrom(): string {
  return toDatetimeLocal(new Date().toISOString());
}

function defaultValidTo(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return toDatetimeLocal(d.toISOString());
}

// Купонд Устгах товч ЗОРИУДАА байхгүй (Category/Product-той ИЖИЛ §Даалгавар
// зарчим) — coupon_redemptions-той foreign key зөрчилдөх эрсдэлтэй тул
// зөвхөн "Идэвхгүй болгох" toggle-оор шийднэ.
export function CouponDialog({ open, onOpenChange, coupon }: CouponDialogProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = coupon !== null;

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] =
    useState<CouponDiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState("1");
  const [validFrom, setValidFrom] = useState(defaultValidFrom());
  const [validTo, setValidTo] = useState(defaultValidTo());
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(coupon?.code ?? "");
    setDescription(coupon?.description ?? "");
    setDiscountType(coupon?.discountType ?? "PERCENTAGE");
    setDiscountValue(coupon?.discountValue ?? "");
    setMaxDiscountAmount(coupon?.maxDiscountAmount ?? "");
    setMinOrderAmount(coupon?.minOrderAmount ?? "");
    setUsageLimit(coupon?.usageLimit != null ? String(coupon.usageLimit) : "");
    setUsageLimitPerCustomer(String(coupon?.usageLimitPerCustomer ?? 1));
    setValidFrom(
      coupon ? toDatetimeLocal(coupon.validFrom) : defaultValidFrom(),
    );
    setValidTo(coupon ? toDatetimeLocal(coupon.validTo) : defaultValidTo());
    setIsActive(coupon?.isActive ?? true);
  }, [open, coupon]);

  const mutation = useMutation({
    mutationFn: () => {
      const dto: CouponInput = {
        code,
        description: description || undefined,
        discountType,
        discountValue: Number(discountValue),
        maxDiscountAmount: maxDiscountAmount
          ? Number(maxDiscountAmount)
          : undefined,
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        usageLimitPerCustomer: usageLimitPerCustomer
          ? Number(usageLimitPerCustomer)
          : undefined,
        validFrom: new Date(validFrom).toISOString(),
        validTo: new Date(validTo).toISOString(),
        isActive,
      };
      return isEdit
        ? updateCoupon(accessToken, coupon.id, dto)
        : createCoupon(accessToken, dto);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["coupons"] });
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
          <DialogTitle>{isEdit ? "Купон засах" : "Шинэ купон"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Купоны мэдээллийг шинэчилнэ."
              : "Шинэ хямдралын купон нэмнэ."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="coupon-code">Код</Label>
            <Input
              id="coupon-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="жиш: SALE2026"
              required
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coupon-description">Тайлбар</Label>
            <Textarea
              id="coupon-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-discount-type">Хямдралын төрөл</Label>
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType(v as CouponDiscountType)}
                disabled={mutation.isPending}
              >
                <SelectTrigger id="coupon-discount-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Хувиар (%)</SelectItem>
                  <SelectItem value="FIXED_AMOUNT">Тогтмол дүн (₮)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-discount-value">
                Утга {discountType === "PERCENTAGE" ? "(0-100)" : "(₮)"}
              </Label>
              <Input
                id="coupon-discount-value"
                type="number"
                min={0}
                max={discountType === "PERCENTAGE" ? 100 : undefined}
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {discountType === "PERCENTAGE" && (
            <div className="space-y-1.5">
              <Label htmlFor="coupon-max-discount">
                Хямдралын дээд хязгаар (₮, сонголтоор)
              </Label>
              <Input
                id="coupon-max-discount"
                type="number"
                min={0}
                step="0.01"
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="coupon-min-order">
              Захиалгын доод дүн (₮, сонголтоор)
            </Label>
            <Input
              id="coupon-min-order"
              type="number"
              min={0}
              step="0.01"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-usage-limit">
                Нийт ашиглалтын хязгаар
              </Label>
              <Input
                id="coupon-usage-limit"
                type="number"
                min={1}
                step="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Хязгааргүй"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-usage-limit-per-customer">
                1 хэрэглэгчид
              </Label>
              <Input
                id="coupon-usage-limit-per-customer"
                type="number"
                min={1}
                step="1"
                value={usageLimitPerCustomer}
                onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-valid-from">Хугацаа эхлэх</Label>
              <Input
                id="coupon-valid-from"
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-valid-to">Хугацаа дуусах</Label>
              <Input
                id="coupon-valid-to"
                type="datetime-local"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                required
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="coupon-active">Идэвхтэй</Label>
            <Switch
              id="coupon-active"
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
