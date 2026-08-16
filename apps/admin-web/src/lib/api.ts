const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface StaffTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: string;
}

export interface MeRole {
  role: string;
  branchId: string | null;
}

export interface MeResponse {
  userId: string;
  roles: MeRole[];
}

interface ApiErrorBody {
  error: { code: string; message: string; details: unknown };
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseErrorOrThrow(res: Response): Promise<never> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // хариу JSON биш байж болзошгүй — доор өгөгдмөл мессежээр орлуулна
  }
  throw new ApiError(
    res.status,
    body?.error?.code ?? "UNKNOWN_ERROR",
    body?.error?.message ?? "Тодорхойгүй алдаа гарлаа",
  );
}

// §6.2: admin-web Keycloak руу шууд хандахгүй, зөвхөн backend-ийн
// /auth/staff/login proxy endpoint-оор дамжина.
export async function staffLogin(
  email: string,
  password: string,
): Promise<StaffTokenPair> {
  const res = await fetch(`${API_URL}/auth/staff/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    await parseErrorOrThrow(res);
  }
  return (await res.json()) as StaffTokenPair;
}

export async function getMe(accessToken: string): Promise<MeResponse> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    await parseErrorOrThrow(res);
  }
  return (await res.json()) as MeResponse;
}
