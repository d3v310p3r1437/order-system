import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DashboardPage() {
  const { email, roleNames, isLoadingRoles } = useAuth();

  const roleLabel = roleNames.length
    ? roleNames.map((r) => ROLE_LABELS[r] ?? r).join(", ")
    : "Эрх оноогдоогүй";

  return (
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
              <span className="font-medium text-foreground">{roleLabel}</span>
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
  );
}
