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

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  parentId?: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  categoryId: string;
  isActive?: boolean;
}

// basePrice/costPrice — Prisma Decimal нь HTTP JSON-д string болж
// сериалайзлагддаг (apps/api/test/catalog-inventory.e2e-spec.ts-ийн
// ProductVariantBody-той адил).
export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unit: string;
  basePrice: string;
  costPrice: string | null;
  barcode: string | null;
  isActive: boolean;
  defaultPreOrderEnabled: boolean;
  defaultPreOrderLeadDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantInput {
  productId: string;
  name: string;
  sku: string;
  unit?: string;
  basePrice: number;
  costPrice?: number;
  barcode?: string;
  isActive?: boolean;
  defaultPreOrderEnabled?: boolean;
  defaultPreOrderLeadDays?: number;
}

export type ProductVariantUpdateInput = Partial<
  Omit<ProductVariantInput, "productId">
>;

export type AvailabilityStatus = "IN_STOCK" | "PRE_ORDER" | "OUT_OF_STOCK";

export interface AvailabilityResult {
  status: AvailabilityStatus;
  leadDays: number | null;
}

export interface ProductVariantWithAvailability extends ProductVariant {
  availability: AvailabilityResult;
}

export interface ProductDetail extends Product {
  variants: ProductVariantWithAvailability[];
}

// InventoryItem.quantity-г ЭНД шууд бичихгүй (§Даалгавар архитектурын
// зарчим) — зөвхөн adjustInventoryQuantity (delta) л quantity-г хөндөнө.
export interface InventoryItem {
  id: string;
  variantId: string;
  branchId: string;
  quantity: number;
  lowStockThreshold: number;
  branchPrice: string | null;
  preOrderEnabledOverride: boolean | null;
  preOrderLeadDaysOverride: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemInput {
  variantId: string;
  branchId: string;
  quantity?: number;
  lowStockThreshold?: number;
  branchPrice?: number;
  preOrderEnabledOverride?: boolean;
  preOrderLeadDaysOverride?: number;
}

export interface UpdateInventoryItemInput {
  lowStockThreshold?: number;
  branchPrice?: number | null;
  preOrderEnabledOverride?: boolean | null;
  preOrderLeadDaysOverride?: number | null;
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

async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    await parseErrorOrThrow(res);
  }
  return (await res.json()) as T;
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

export function getMe(accessToken: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/auth/me", accessToken);
}

// RLS (branches_select) хэн ямар салбарыг харахыг шийднэ — admin-web
// талд дахин шүүлт хийхгүй, ирсэн жагсаалтыг шууд ашиглана.
export function getBranches(accessToken: string): Promise<Branch[]> {
  return apiFetch<Branch[]>("/branches", accessToken);
}

export function getCategories(accessToken: string): Promise<Category[]> {
  return apiFetch<Category[]>("/categories", accessToken);
}

export function createCategory(
  accessToken: string,
  dto: CategoryInput,
): Promise<Category> {
  return apiFetch<Category>("/categories", accessToken, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateCategory(
  accessToken: string,
  id: string,
  dto: Partial<CategoryInput>,
): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export function getProducts(
  accessToken: string,
  categoryId?: string,
): Promise<Product[]> {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  return apiFetch<Product[]>(`/products${qs}`, accessToken);
}

// branchId өгвөл тухайн салбарын, өгөөгүй бол бүх салбараар аггрегатласан
// availability (apps/api/src/catalog/product/product.service.ts-ийн
// findOne-той адил).
export function getProduct(
  accessToken: string,
  id: string,
  branchId?: string,
): Promise<ProductDetail> {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return apiFetch<ProductDetail>(`/products/${id}${qs}`, accessToken);
}

export function createProduct(
  accessToken: string,
  dto: ProductInput,
): Promise<Product> {
  return apiFetch<Product>("/products", accessToken, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateProduct(
  accessToken: string,
  id: string,
  dto: Partial<ProductInput>,
): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export function getProductVariants(
  accessToken: string,
  productId?: string,
): Promise<ProductVariant[]> {
  const qs = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  return apiFetch<ProductVariant[]>(`/product-variants${qs}`, accessToken);
}

export function createProductVariant(
  accessToken: string,
  dto: ProductVariantInput,
): Promise<ProductVariant> {
  return apiFetch<ProductVariant>("/product-variants", accessToken, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateProductVariant(
  accessToken: string,
  id: string,
  dto: ProductVariantUpdateInput,
): Promise<ProductVariant> {
  return apiFetch<ProductVariant>(`/product-variants/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

// RLS (inventory_items_select) хэн ямар салбарын мөрийг харахыг шийднэ —
// branchId/variantId filter зөвхөн тодруулга.
export function getInventoryItems(
  accessToken: string,
  filter: { branchId?: string; variantId?: string },
): Promise<InventoryItem[]> {
  const params = new URLSearchParams();
  if (filter.branchId) params.set("branchId", filter.branchId);
  if (filter.variantId) params.set("variantId", filter.variantId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<InventoryItem[]>(`/inventory-items${qs}`, accessToken);
}

export function createInventoryItem(
  accessToken: string,
  dto: CreateInventoryItemInput,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>("/inventory-items", accessToken, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateInventoryItem(
  accessToken: string,
  id: string,
  dto: UpdateInventoryItemInput,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory-items/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

// "адаг тоогоор солих" биш "нэмэх/хасах" (delta) — InventoryItem.quantity-г
// UI-аас шууд бичихгүй гэсэн архитектурын зарчмыг хангах цорын ганц зам.
export function adjustInventoryQuantity(
  accessToken: string,
  id: string,
  delta: number,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(
    `/inventory-items/${id}/adjust-quantity`,
    accessToken,
    { method: "PATCH", body: JSON.stringify({ delta }) },
  );
}
