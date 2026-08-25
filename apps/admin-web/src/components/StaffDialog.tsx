import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStaff,
  getBranches,
  updateStaff,
  type CreateStaffResult,
  type StaffMember,
  type StaffRoleName,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/roles";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember | null;
}

const STAFF_ROLE_OPTIONS: StaffRoleName[] = [
  "SUPER_ADMIN",
  "OWNER",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
  "BRANCH_MANAGER",
  "SALESPERSON",
];
const GLOBAL_ROLES: StaffRoleName[] = ["SUPER_ADMIN", "OWNER", "ALL_BRANCH_MANAGER"];

// §Даалгавар: "ажилтны эрх удирдах UI" (docs/adr/002-ийн "Инцидент
// (2026-08-25)"-ийг сэргээхгүй байх зорилготой) — Category/Product/
// Coupon-той ИЖИЛ "жагсаалт + Нэмэх/Засах dialog" загвар, Устгах товч
// ЗОРИУДАА байхгүй (зөвхөн isActive toggle). ⚠️ Засах горимд ГАНЦ
// (role, branchId) хосыг л удирдана — staff нэг мөнх нэг гол дүртэй
// гэсэн MVP-ийн энгийн загвар (POST /staff ч зөвхөн 1 дүр үүсгэдэг тул
// тохирно), олон дүртэй ажилтныг эндээс бүрэн удирдах боломжгүй.
export function StaffDialog({ open, onOpenChange, staff }: StaffDialogProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = staff !== null;
  const currentAssignment = staff?.roles[0] ?? null;

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRoleName>("SALESPERSON");
  const [branchId, setBranchId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [createdResult, setCreatedResult] = useState<CreateStaffResult | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["branches", accessToken],
    queryFn: () => getBranches(accessToken),
  });

  useEffect(() => {
    if (!open) return;
    setCreatedResult(null);
    setEmail("");
    setFullName(staff?.fullName ?? "");
    setRole(currentAssignment?.role ?? "SALESPERSON");
    setBranchId(currentAssignment?.branchId ?? "");
    setIsActive(staff?.isActive ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff]);

  const isGlobalRole = GLOBAL_ROLES.includes(role);

  const createMutation = useMutation({
    mutationFn: () =>
      createStaff(accessToken, {
        email,
        fullName,
        role,
        branchId: isGlobalRole ? undefined : branchId,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      // ⚠️ ЗОРИУДАА автоматаар ХААХГҮЙ — temporaryPassword-ийг
      // (KeycloakAdminService.setPassword()-ийн коммент: ХААНА Ч
      // хадгалагдахгүй, ЗӨВХӨН ЭНЭ хариунд НЭГ Л УДАА ирнэ) админд
      // харуулж, тэмдэглэж авах боломж өгнө.
      setCreatedResult(result);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateStaff(accessToken, staff!.id, {
        oldBranchId: currentAssignment?.branchId ?? null,
        role,
        branchId: isGlobalRole ? undefined : branchId,
        isActive,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
    },
  });

  const mutation = isEdit ? updateMutation : createMutation;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (createdResult) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ажилтан амжилттай үүслээ</DialogTitle>
            <DialogDescription>
              Доорх түр нууц үгийг ажилтанд аюулгүй сувгаар дамжуулна уу —
              энэ дэлгэц хаагдсаны дараа ДАХИН харах боломжгүй.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div>
              <span className="text-muted-foreground">И-мэйл: </span>
              <span className="font-medium">{createdResult.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Түр нууц үг: </span>
              <code className="rounded bg-background px-2 py-1 font-mono text-sm">
                {createdResult.temporaryPassword}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Ойлголоо</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ажилтан засах" : "Шинэ ажилтан"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Дүр/салбар сольж, идэвхжүүлэх/идэвхгүй болгоно."
              : "Keycloak БОЛОН Postgres-д ХАМТ (атомик) шинэ ажилтан бүртгэнэ."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">И-мэйл</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={mutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-full-name">Овог нэр</Label>
                <Input
                  id="staff-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="жиш: Бат Болд"
                  required
                  disabled={mutation.isPending}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="staff-role">Дүр</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as StaffRoleName)}
                disabled={mutation.isPending}
              >
                <SelectTrigger id="staff-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isGlobalRole && (
              <div className="space-y-1.5">
                <Label htmlFor="staff-branch">Салбар</Label>
                <Select
                  value={branchId}
                  onValueChange={setBranchId}
                  disabled={mutation.isPending}
                >
                  <SelectTrigger id="staff-branch" className="w-full">
                    <SelectValue placeholder="Сонгох" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branchesQuery.data ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="staff-active">Идэвхтэй</Label>
              <Switch
                id="staff-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={mutation.isPending}
              />
            </div>
          )}

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
