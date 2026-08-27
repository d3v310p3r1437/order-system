import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMe, type MeRole } from "@/lib/api";
import { hasAnyRole } from "@/lib/roles";

export interface StaffSession {
  accessToken: string;
  email: string;
}

interface AuthContextValue {
  accessToken: string;
  email: string;
  // §7 модуль #13 (SupportTicketDetailPage): чатны мессежийг "өөрийн"/
  // "бусдын" гэж ялгахад хэрэгтэй болсон тул GET /auth/me-ийн userId-г
  // нэмж дамжуулав (MeResponse-д аль хэдийн байсан талбар).
  userId: string | null;
  roles: MeRole[];
  roleNames: string[];
  hasRole: (allowedRoles: readonly string[]) => boolean;
  isLoadingRoles: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  session: StaffSession;
  onLogout: () => void;
  children: ReactNode;
}

// ADR 004: session (accessToken) зөвхөн дуудагч App.tsx-ийн in-memory
// useState-аас ирнэ, энд ЯМАР Ч persist хийхгүй. Role-г JWT-ээс биш
// GET /auth/me-ээс (user_branch_roles, RLS-ээр хамгаалагдсан) уншина
// (§6.2) — token хүчингүй/хугацаа дууссан бол автоматаар гарна.
export function AuthProvider({ session, onLogout, children }: AuthProviderProps) {
  const meQuery = useQuery({
    queryKey: ["me", session.accessToken],
    queryFn: () => getMe(session.accessToken),
    retry: false,
  });

  useEffect(() => {
    if (meQuery.isError) {
      onLogout();
    }
  }, [meQuery.isError, onLogout]);

  const roles = meQuery.data?.roles ?? [];
  const roleNames = roles.map((r) => r.role);

  const value: AuthContextValue = {
    accessToken: session.accessToken,
    email: session.email,
    userId: meQuery.data?.userId ?? null,
    roles,
    roleNames,
    hasRole: (allowedRoles) => hasAnyRole(roleNames, allowedRoles),
    isLoadingRoles: meQuery.isLoading,
    logout: onLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() зөвхөн AuthProvider дотор ашиглана");
  }
  return ctx;
}
