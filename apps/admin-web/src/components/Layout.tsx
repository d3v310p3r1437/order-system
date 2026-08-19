import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useOrderEvents } from "@/lib/realtime";
import { REPORT_VIEW_ROLES, ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Хянах самбар" },
  { to: "/categories", label: "Ангилал" },
  { to: "/products", label: "Бүтээгдэхүүн" },
  { to: "/inventory", label: "Агуулах" },
  { to: "/orders", label: "Захиалгууд" },
  { to: "/returns", label: "Буцаалтууд" },
  // SALESPERSON/CUSTOMER §6.1 матрицад "Тайлан/аналитик"-д огт эрхгүй
  // (бусад мөрөнд байдаг "зөвхөн харна"-той адил хэсэгчилсэн ХАРАГДАХГҮЙ,
  // 403-той хоосон хуудас руу шилжихийн оронд нэвтрэлтийн цэснээс нуусан).
  { to: "/reports", label: "Тайлан", roles: REPORT_VIEW_ROLES },
];

export function Layout() {
  const { accessToken, email, roleNames, isLoadingRoles, hasRole, logout } =
    useAuth();
  useOrderEvents(accessToken);

  const roleLabel = isLoadingRoles
    ? "Ачааллаж байна…"
    : roleNames.length
      ? roleNames.map((r) => ROLE_LABELS[r] ?? r).join(", ")
      : "Эрх оноогдоогүй";

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasRole(item.roles),
  );

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card sm:flex">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4 text-sm font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            ЗС
          </span>
          Админ самбар
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <div className="text-sm">
            <span className="font-medium text-foreground">{email}</span>
            <span className="text-muted-foreground"> · {roleLabel}</span>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            Гарах
          </Button>
        </header>
        <main className="flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
