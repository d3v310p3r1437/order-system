import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStaff, type StaffMember } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS, STAFF_MANAGE_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StaffDialog } from "@/components/StaffDialog";

// docs/adr/002-ийн "Инцидент (2026-08-25)" — super.admin@order-system.mn-ийн
// Postgres users мөр дутуу гар тохиргооноос болж алга болсныг ДАХИН
// давтагдахаас сэргийлэх зорилготой UI: POST/PATCH /staff (Keycloak+
// Postgres атомик) endpoint-ыг Category/Product/Coupon-той ИЖИЛ
// "жагсаалт + Нэмэх/Засах dialog" загвараар илэрхийлнэ.
export function StaffPage() {
  const { accessToken, hasRole } = useAuth();
  const canManage = hasRole(STAFF_MANAGE_ROLES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => getStaff(accessToken),
    enabled: canManage,
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(staff: StaffMember) {
    setEditing(staff);
    setDialogOpen(true);
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Энэ хуудсыг харах эрхгүй байна.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ажилтнууд</h1>
          <p className="text-sm text-muted-foreground">
            Шинэ ажилтан бүртгэх (Keycloak+Postgres хамт), дүр/салбар солих,
            идэвхжүүлэх/идэвхгүй болгох.
          </p>
        </div>
        <Button onClick={openCreate}>Ажилтан нэмэх</Button>
      </div>

      <Card>
        <CardContent>
          {staffQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {staffQuery.isError && (
            <p className="text-sm text-destructive">
              Ажилтны мэдээлэл татахад алдаа гарлаа.
            </p>
          )}
          {staffQuery.isSuccess && staffQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Одоогоор ажилтан бүртгэгдээгүй байна.
            </p>
          )}

          <ul className="divide-y divide-border">
            {(staffQuery.data ?? []).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {s.fullName ?? s.email}
                    </span>
                    {!s.isActive && <Badge variant="secondary">Идэвхгүй</Badge>}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {s.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.roles.length === 0
                      ? "Дүр оноогдоогүй"
                      : s.roles
                          .map(
                            (r) =>
                              `${ROLE_LABELS[r.role] ?? r.role}${r.branchName ? ` (${r.branchName})` : ""}`,
                          )
                          .join(", ")}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                  Засах
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <StaffDialog open={dialogOpen} onOpenChange={setDialogOpen} staff={editing} />
    </div>
  );
}
