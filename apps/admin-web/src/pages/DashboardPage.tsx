import { useAuth } from "@/lib/auth-context";
import {
  BRANDING_WRITE_ROLES,
  REPORT_VIEW_ROLES,
  RETURN_FEE_WRITE_ROLES,
  ROLE_LABELS,
} from "@/lib/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReturnFeeSettingCard } from "@/components/ReturnFeeSettingCard";
import { BrandingSettingCard } from "@/components/BrandingSettingCard";
import { DashboardKpiCards } from "@/components/DashboardKpiCards";

export function DashboardPage() {
  const { email, roleNames, isLoadingRoles, hasRole } = useAuth();

  const roleLabel = roleNames.length
    ? roleNames.map((r) => ROLE_LABELS[r] ?? r).join(", ")
    : "Эрх оноогдоогүй";

  return (
    <div className="space-y-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-xl">
            {isLoadingRoles ? "Ачааллаж байна…" : `Тавтай морил, ${email}`}
          </CardTitle>
          <CardDescription>
            {isLoadingRoles ? (
              "Эрхийн мэдээлэл татаж байна…"
            ) : (
              <>
                Дүр:{" "}
                <span className="font-medium text-foreground">
                  {roleLabel}
                </span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Энэ мэдээлэл JWT-ээс биш,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            GET /auth/me
          </code>{" "}
          эндпойнтоор дамжуулан{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            user_branch_roles
          </code>{" "}
          хүснэгтээс (RLS-ээр хамгаалагдсан) уншигдсан болно. Зүүн талын
          цэснээс каталог, агуулахын мэдээлэл рүү шилжинэ үү.
        </CardContent>
      </Card>

      {!isLoadingRoles && hasRole(REPORT_VIEW_ROLES) && <DashboardKpiCards />}

      {!isLoadingRoles && hasRole(RETURN_FEE_WRITE_ROLES) && (
        <ReturnFeeSettingCard />
      )}

      {!isLoadingRoles && hasRole(BRANDING_WRITE_ROLES) && <BrandingSettingCard />}
    </div>
  );
}
