import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCoupons, type Coupon } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COUPON_CREATE_ROLES, COUPON_UPDATE_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CouponDialog } from "@/components/CouponDialog";

function formatDiscount(coupon: Coupon): string {
  return coupon.discountType === "PERCENTAGE"
    ? `${coupon.discountValue}%`
    : `${Number(coupon.discountValue).toLocaleString("mn-MN")}₮`;
}

function isExpired(coupon: Coupon): boolean {
  return new Date(coupon.validTo).getTime() < Date.now();
}

// §7 модуль #10, §6.1 матриц "Урамшуулал/купон" мөр: жагсаалт (RLS-ээр
// хэрэглэгчийн эрхээр аль хэдийн шүүгдсэн — CUSTOMER-д admin-web ашиглах
// хэрэггүй ч BRANCH_MANAGER/SALESPERSON "—" эрхтэй тул хоосон жагсаалт
// харна), Нэмэх/Засах dialog. Category/Product-той ИЖИЛ зарчим: Устгах
// товч ЗОРИУДАА байхгүй, зөвхөн "Идэвхгүй болгох" toggle (CouponDialog-ийн
// isActive switch).
export function CouponsPage() {
  const { accessToken, hasRole } = useAuth();
  const canCreate = hasRole(COUPON_CREATE_ROLES);
  const canUpdate = hasRole(COUPON_UPDATE_ROLES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const couponsQuery = useQuery({
    queryKey: ["coupons"],
    queryFn: () => getCoupons(accessToken),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Урамшуулал/купон
          </h1>
          <p className="text-sm text-muted-foreground">
            Хямдралын купон үүсгэх, засах, идэвхжүүлэх/идэвхгүй болгох.
          </p>
        </div>
        {canCreate && <Button onClick={openCreate}>Купон нэмэх</Button>}
      </div>

      <Card>
        <CardContent>
          {couponsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {couponsQuery.isError && (
            <p className="text-sm text-destructive">
              Купоны мэдээлэл татахад алдаа гарлаа.
            </p>
          )}
          {couponsQuery.isSuccess && couponsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Одоогоор купон бүртгэгдээгүй байна.
            </p>
          )}

          <ul className="divide-y divide-border">
            {(couponsQuery.data ?? []).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.code}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDiscount(c)}
                    </span>
                    {!c.isActive && <Badge variant="secondary">Идэвхгүй</Badge>}
                    {c.isActive && isExpired(c) && (
                      <Badge variant="secondary">Хугацаа дууссан</Badge>
                    )}
                  </div>
                  {c.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {c.description}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Ашиглалт: {c.usageCount}
                    {c.usageLimit != null ? `/${c.usageLimit}` : ""} ·{" "}
                    {new Date(c.validFrom).toLocaleDateString("mn-MN")} –{" "}
                    {new Date(c.validTo).toLocaleDateString("mn-MN")}
                  </span>
                </div>
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                    Засах
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {(canCreate || canUpdate) && (
        <CouponDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          coupon={editing}
        />
      )}
    </div>
  );
}
