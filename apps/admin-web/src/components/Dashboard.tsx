import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardProps {
  accessToken: string;
  email: string;
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Супер админ",
  OWNER: "Дэлгүүрийн эзэн",
  ALL_BRANCH_MANAGER: "Бүх-салбарын менежер",
  BRANCH_ADMIN: "Салбарын админ",
  BRANCH_MANAGER: "Салбарын менежер",
  SALESPERSON: "Худалдагч",
  CUSTOMER: "Харилцагч",
};

export function Dashboard({ accessToken, email, onLogout }: DashboardProps) {
  const meQuery = useQuery({
    queryKey: ["me", accessToken],
    queryFn: () => getMe(accessToken),
    retry: false,
  });

  // Token хүчингүй/хугацаа дууссан бол дахин нэвтрэх дэлгэц рүү буцаана.
  useEffect(() => {
    if (meQuery.isError) {
      onLogout();
    }
  }, [meQuery.isError, onLogout]);

  const roleLabels = meQuery.data?.roles.length
    ? meQuery.data.roles
        .map((r) => ROLE_LABELS[r.role] ?? r.role)
        .join(", ")
    : "Эрх оноогдоогүй";

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              ЗС
            </span>
            Захиалгын систем — Админ самбар
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Гарах
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-xl">
              {meQuery.isLoading
                ? "Ачааллаж байна…"
                : `Тавтай морил, ${email}`}
            </CardTitle>
            <CardDescription>
              {meQuery.isLoading ? (
                "Эрхийн мэдээлэл татаж байна…"
              ) : (
                <>
                  Дүр:{" "}
                  <span className="font-medium text-foreground">
                    {roleLabels}
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
            эндпойнтоор дамжуулан <code className="rounded bg-muted px-1 py-0.5 text-xs">user_branch_roles</code>{" "}
            хүснэгтээс (RLS-ээр хамгаалагдсан) уншигдсан болно.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
