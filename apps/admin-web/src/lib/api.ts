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
  color: string | null;
  size: string | null;
  attributes: Record<string, string> | null;
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
  color?: string;
  size?: string;
  attributes?: Record<string, string>;
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

// apps/api/src/catalog/product-image/product-image.service.ts-ийн
// upload()-ийн буцаах хариу (url — MinioService.getPublicUrl()).
export interface ProductImage {
  id: string;
  productId: string;
  objectKey: string;
  displayOrder: number;
  altText: string | null;
  createdAt: string;
  url: string;
}

export interface ProductDetail extends Product {
  variants: ProductVariantWithAvailability[];
  images: ProductImage[];
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

export type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unitPriceSnapshot: string;
  createdAt: string;
}

export type OrderDeliveryMethod = "PICKUP" | "DELIVERY";

// totalAmount — Prisma Decimal нь HTTP JSON-д string болж сериалайзлагддаг
// (ProductVariant.basePrice-тэй адил).
export interface Order {
  id: string;
  customerId: string;
  branchId: string;
  status: OrderStatus;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  providerInvoiceId: string | null;
  paidAt: string | null;
  // apps/api/src/orders/dto/checkout-order.dto.ts-тэй тохирно —
  // deliveryMethod=DELIVERY үед л Address/Latitude/Longitude утгатай.
  deliveryMethod: OrderDeliveryMethod;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  items: OrderItem[];
}

// apps/api/src/routing/routing-provider.interface.ts-ийн RouteResult-той
// тохирно — geometry нь [lng, lat] дараалалтай (GeoJSON/OSRM стандарт),
// Leaflet-ийн [lat, lng]-той ЯЛГААТАЙ (DeliveryRouteMap.tsx-ийн тайлбарыг үз).
export interface OrderRoute {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][];
}

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "REFUNDED"
  | "REFUND_FAILED";

// apps/api/src/returns/return-request.service.ts-ийн ORDER_ITEM_INCLUDE-тэй
// адил (orderItem.order) — детэйл дэлгэцэд захиалгын дугаар/дүн харуулахад
// хэрэгтэй.
export interface ReturnRequestOrderItem {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unitPriceSnapshot: string;
  order: {
    id: string;
    branchId: string;
    customerId: string;
    status: OrderStatus;
    providerInvoiceId: string | null;
  };
}

export interface ReturnRequest {
  id: string;
  orderItemId: string;
  requestedByUserId: string;
  status: ReturnStatus;
  reason: string;
  rejectedReason: string | null;
  // refundFeePercent/refundAmount — Prisma Decimal тул JSON-д string
  // (basePrice/totalAmount-тай адил), зөвшөөрөгдөх хүртэл null.
  refundFeePercent: string | null;
  refundAmount: string | null;
  providerRefundId: string | null;
  reviewedByUserId: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  refundedAt: string | null;
  orderItem: ReturnRequestOrderItem;
}

export interface ReturnFeeSetting {
  key: string;
  value: string;
  updatedByUserId: string | null;
  updatedAt: string | null;
}

// apps/api/src/reports/report.service.ts-ийн буцаах хэлбэртэй тохирно —
// мөнгөн дүн бүхий талбарууд Prisma Decimal-тай адил зарчмаар (жиш:
// Order.totalAmount) string болж сериалайзлагддаг.
export interface SalesSummary {
  from: string;
  to: string;
  branchId: string | null;
  totalRevenue: string;
  orderCount: number;
  averageOrderAmount: string;
  returnAmount: string;
  returnCount: number;
}

export interface TopProduct {
  variantId: string;
  productName: string;
  variantName: string;
  quantitySold: number;
  revenue: string;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: string;
  orderCount: number;
}

export interface BranchComparisonRow {
  branchId: string;
  branchName: string;
  revenue: string;
  orderCount: number;
}

export interface ReportDateRangeFilter {
  from: string;
  to: string;
  branchId?: string;
}

export type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

// discountValue/maxDiscountAmount/minOrderAmount — Prisma Decimal тул
// HTTP JSON-д string болж сериалайзлагддаг (ProductVariant.basePrice-тэй
// адил зарчим).
export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderAmount: string | null;
  usageLimit: number | null;
  usageCount: number;
  usageLimitPerCustomer: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CouponInput {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  validFrom: string;
  validTo: string;
  isActive?: boolean;
}

export type CouponUpdateInput = Partial<CouponInput>;

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

// multipart/form-data upload-д зориулсан тусдаа хувилбар — apiFetch()-ийн
// адил "body байвал Content-Type: application/json" таамаглал энд БУРУУ
// (FormData-ийн boundary-г browser өөрөө автоматаар тохируулах ёстой,
// Content-Type-г ГАРААР бичвэл эвдэрнэ).
async function apiUpload<T>(
  path: string,
  accessToken: string,
  formData: FormData,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
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

// apps/api/src/catalog/product-image/product-image.controller.ts-ийн
// POST /products/:productId/images (multipart/form-data).
export function uploadProductImage(
  accessToken: string,
  productId: string,
  file: File,
  opts: { displayOrder?: number; altText?: string } = {},
): Promise<ProductImage> {
  const formData = new FormData();
  formData.append("file", file);
  if (opts.displayOrder !== undefined) {
    formData.append("displayOrder", String(opts.displayOrder));
  }
  if (opts.altText) {
    formData.append("altText", opts.altText);
  }
  return apiUpload<ProductImage>(
    `/products/${productId}/images`,
    accessToken,
    formData,
  );
}

export function deleteProductImage(
  accessToken: string,
  productId: string,
  imageId: string,
): Promise<ProductImage> {
  return apiFetch<ProductImage>(
    `/products/${productId}/images/${imageId}`,
    accessToken,
    { method: "DELETE" },
  );
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

// RLS (orders_select) хэн ямар мөрийг харахыг шийднэ — branchId/status
// filter зөвхөн тодруулга.
export function getOrders(
  accessToken: string,
  filter: { branchId?: string; status?: OrderStatus },
): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filter.branchId) params.set("branchId", filter.branchId);
  if (filter.status) params.set("status", filter.status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<Order[]>(`/orders${qs}`, accessToken);
}

export function getOrder(accessToken: string, id: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`, accessToken);
}

// apps/api/src/orders/order.controller.ts-ийн GET /orders/:id/route
// (staff-only) — зөвхөн deliveryMethod=DELIVERY захиалганд амжилттай
// хариу буцаана, PICKUP-д 400 NOT_DELIVERY_ORDER.
export function getOrderRoute(
  accessToken: string,
  id: string,
): Promise<OrderRoute> {
  return apiFetch<OrderRoute>(`/orders/${id}/route`, accessToken);
}

// apps/api/src/orders/order.controller.ts-ийн PATCH /orders/:id/status-той
// адил — staff-ийн ерөнхий шилжилт БОЛОН харилцагчийн cancel хоёулаа энэ
// ганц endpoint-оор дамждаг ч admin-web зөвхөн staff талыг ашиглана.
export function updateOrderStatus(
  accessToken: string,
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}/status`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// RLS (return_requests_select) хэн ямар мөрийг харахыг шийднэ — status
// filter зөвхөн тодруулга (apps/api/src/returns/return-request.controller.ts).
export function getReturnRequests(
  accessToken: string,
  filter: { status?: ReturnStatus },
): Promise<ReturnRequest[]> {
  const qs = filter.status ? `?status=${encodeURIComponent(filter.status)}` : "";
  return apiFetch<ReturnRequest[]>(`/returns${qs}`, accessToken);
}

export function getReturnRequest(
  accessToken: string,
  id: string,
): Promise<ReturnRequest> {
  return apiFetch<ReturnRequest>(`/returns/${id}`, accessToken);
}

// Нэг PATCH дотор шимтгэл тооцож, refund дуудаад REFUNDED/REFUND_FAILED
// болгоно (apps/api/src/returns/return-request.service.ts-ийн approve()).
export function approveReturnRequest(
  accessToken: string,
  id: string,
): Promise<ReturnRequest> {
  return apiFetch<ReturnRequest>(`/returns/${id}/approve`, accessToken, {
    method: "PATCH",
  });
}

export function rejectReturnRequest(
  accessToken: string,
  id: string,
  rejectedReason: string,
): Promise<ReturnRequest> {
  return apiFetch<ReturnRequest>(`/returns/${id}/reject`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ rejectedReason }),
  });
}

export function getReturnFeePercent(
  accessToken: string,
): Promise<ReturnFeeSetting> {
  return apiFetch<ReturnFeeSetting>("/settings/return-fee-percent", accessToken);
}

export function updateReturnFeePercent(
  accessToken: string,
  value: number,
): Promise<ReturnFeeSetting> {
  return apiFetch<ReturnFeeSetting>("/settings/return-fee-percent", accessToken, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

// apps/api/src/catalog/search/search.controller.ts-ийн GET /catalog/search —
// @Roles()-гүй (нэвтэрсэн ямар ч дүр дуудна), Meilisearch-аар нэрээр хайж,
// availability-тэй хамт буцаана (ProductDetail-тэй ижил хэлбэр).
export function searchProducts(
  accessToken: string,
  filter: { q?: string; categoryId?: string; branchId?: string },
): Promise<ProductDetail[]> {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.categoryId) params.set("categoryId", filter.categoryId);
  if (filter.branchId) params.set("branchId", filter.branchId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ProductDetail[]>(`/catalog/search${qs}`, accessToken);
}

// apps/api/src/reports/report.controller.ts-ийн REPORT_VIEW_ROLES/
// BRANCH_COMPARISON_ROLES-тэй тохирно (roles.ts-ийн тайлбарыг үз) — RLS
// (orders_select гэх мэт) хэн ямар салбарын мэдээллийг харахыг шийднэ,
// branchId filter зөвхөн тодруулга.
function buildReportQuery(filter: ReportDateRangeFilter): URLSearchParams {
  const params = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.branchId) params.set("branchId", filter.branchId);
  return params;
}

export function getSalesSummary(
  accessToken: string,
  filter: ReportDateRangeFilter,
): Promise<SalesSummary> {
  return apiFetch<SalesSummary>(
    `/reports/sales-summary?${buildReportQuery(filter).toString()}`,
    accessToken,
  );
}

export function getTopProducts(
  accessToken: string,
  filter: ReportDateRangeFilter & { limit?: number },
): Promise<TopProduct[]> {
  const params = buildReportQuery(filter);
  if (filter.limit) params.set("limit", String(filter.limit));
  return apiFetch<TopProduct[]>(
    `/reports/top-products?${params.toString()}`,
    accessToken,
  );
}

export function getRevenueTrend(
  accessToken: string,
  filter: ReportDateRangeFilter,
): Promise<RevenueTrendPoint[]> {
  return apiFetch<RevenueTrendPoint[]>(
    `/reports/revenue-trend?${buildReportQuery(filter).toString()}`,
    accessToken,
  );
}

// branchId параметргүй (§Даалгавар: БҮХ салбарыг харьцуулна) —
// BRANCH_COMPARISON_ROLES-гүй дүрд backend 403 буцаана.
export function getBranchComparison(
  accessToken: string,
  filter: { from: string; to: string },
): Promise<BranchComparisonRow[]> {
  const params = new URLSearchParams({ from: filter.from, to: filter.to });
  return apiFetch<BranchComparisonRow[]>(
    `/reports/branch-comparison?${params.toString()}`,
    accessToken,
  );
}

// apps/api/src/reports/report.controller.ts-ийн GET
// /reports/sales-summary/export — apiFetch()-ийн адил "Content-Type:
// application/json" таамаглал БУРУУ (хариу CSV Blob) тул тусдаа хувилбар
// (apiUpload()-той ижил "нийтлэг apiFetch()-д тохирохгүй тусгай зам" зарчим).
export async function exportSalesSummaryCsv(
  accessToken: string,
  filter: ReportDateRangeFilter,
): Promise<Blob> {
  const params = buildReportQuery(filter);
  params.set("format", "csv");
  const res = await fetch(
    `${API_URL}/reports/sales-summary/export?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    await parseErrorOrThrow(res);
  }
  return res.blob();
}

// apps/api/src/coupons/coupon.controller.ts-ийн GET /coupons — RLS
// (coupons_select) хэн ямар мөрийг харахыг шийднэ (§6.1 матриц), admin-web
// талд дахин шүүлт хийхгүй.
export function getCoupons(accessToken: string): Promise<Coupon[]> {
  return apiFetch<Coupon[]>("/coupons", accessToken);
}

export function getCoupon(accessToken: string, id: string): Promise<Coupon> {
  return apiFetch<Coupon>(`/coupons/${id}`, accessToken);
}

export function createCoupon(
  accessToken: string,
  dto: CouponInput,
): Promise<Coupon> {
  return apiFetch<Coupon>("/coupons", accessToken, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateCoupon(
  accessToken: string,
  id: string,
  dto: CouponUpdateInput,
): Promise<Coupon> {
  return apiFetch<Coupon>(`/coupons/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export type StaffRoleName =
  | "SUPER_ADMIN"
  | "OWNER"
  | "ALL_BRANCH_MANAGER"
  | "BRANCH_ADMIN"
  | "BRANCH_MANAGER"
  | "SALESPERSON";

export interface StaffRoleAssignment {
  role: StaffRoleName;
  branchId: string | null;
  branchName: string | null;
}

// apps/api/src/staff/staff.service.ts-ийн StaffListItem-тэй тохирно.
export interface StaffMember {
  id: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  createdAt: string;
  roles: StaffRoleAssignment[];
}

export interface CreateStaffInput {
  email: string;
  fullName: string;
  role: StaffRoleName;
  branchId?: string;
}

// docs/adr/002-ийн "Инцидент (2026-08-25)"-ийг сэргээхгүй байх зорилготой
// атомик (Keycloak+Postgres) endpoint-ийн хариу — temporaryPassword ЗӨВХӨН
// ЭНД, НЭГ Л УДАА ирнэ (StaffDialog.tsx-д харуулж, дараа нь хэзээ ч дахин
// сэргээж авах боломжгүй тухай анхааруулга харуулна).
export interface CreateStaffResult extends StaffMember {
  role: StaffRoleName;
  branchId: string | null;
  temporaryPassword: string;
}

export interface UpdateStaffInput {
  oldBranchId?: string | null;
  role?: StaffRoleName;
  branchId?: string;
  isActive?: boolean;
}

// RLS (users_select/ubr_select) хэн ямар ажилтныг харахыг шийднэ —
// admin-web талд дахин шүүлт хийхгүй.
export function getStaff(
  accessToken: string,
  filter: { role?: StaffRoleName; branchId?: string } = {},
): Promise<StaffMember[]> {
  const params = new URLSearchParams();
  if (filter.role) params.set("role", filter.role);
  if (filter.branchId) params.set("branchId", filter.branchId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<StaffMember[]>(`/staff${qs}`, accessToken);
}

export function createStaff(
  accessToken: string,
  dto: CreateStaffInput,
): Promise<CreateStaffResult> {
  return apiFetch<CreateStaffResult>("/staff", accessToken, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateStaff(
  accessToken: string,
  id: string,
  dto: UpdateStaffInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/staff/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

// apps/api/src/audit/audit-log.controller.ts-тэй тохирно. beforeData/
// afterData-ийн бодит бүтэц mutation бүрээр өөр (@Audit()-ийн tableName-аас
// хамаарна) тул зориудаар `unknown`.
export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  tableName: string;
  recordId: string;
  beforeData: unknown;
  afterData: unknown;
  branchId: string | null;
  createdAt: string;
}

export interface AuditLogFilter {
  tableName?: string;
  action?: string;
  recordId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

// ⚠️ audit-log.controller.ts-ийн коммент: branchId ХЭЗЭЭ Ч populate
// хийгддэггүй тул ЗӨВХӨН глобал-эрхийн дүрд (AUDIT_LOG_VIEW_ROLES) л
// амжилттай хариу буцаана (roles.ts-ийн AUDIT_LOG_VIEW_ROLES-той тохирно).
// apps/api/src/reviews/review.controller.ts, review-product.controller.ts-тэй
// тохирно (§7 модуль #11).
export interface Review {
  id: string;
  customerId: string;
  productId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET /reviews (модераци, зөвхөн REVIEW_MODERATION_ROLES) — бүтээгдэхүүний
// нэрийг ЯГ backend-ийн include-той (id, name) тохируулав.
export interface ReviewModerationEntry extends Review {
  product: { id: string; name: string };
}

export interface ReviewModerationList {
  reviews: ReviewModerationEntry[];
  totalCount: number;
  page: number;
  limit: number;
}

export function getReviewsForModeration(
  accessToken: string,
  page = 1,
): Promise<ReviewModerationList> {
  return apiFetch<ReviewModerationList>(`/reviews?page=${page}`, accessToken);
}

// reviews_delete RLS "ӨӨРИЙН ЭСВЭЛ app_has_global_scope()" — энэ дэлгэц
// зөвхөн модераци (global scope) зорилготой тул ЭНД устгах нь ЯГ л
// модерацийн үйлдэл.
export function deleteReview(
  accessToken: string,
  id: string,
): Promise<Review> {
  return apiFetch<Review>(`/reviews/${id}`, accessToken, {
    method: "DELETE",
  });
}

// apps/api/src/support/support-ticket.controller.ts-тэй (§7 модуль #13)
// тохирно.
export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type SupportTicketCategory =
  | "ORDER_ISSUE"
  | "PAYMENT_ISSUE"
  | "DELIVERY_ISSUE"
  | "PRODUCT_QUESTION"
  | "ACCOUNT_ISSUE"
  | "OTHER";

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  orderId: string | null;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
}

// RLS (support_tickets_select) хэн ямар мөрийг харахыг шийднэ (харилцагч:
// өөрийнх, staff: харах эрхтэй бүгд) — status/category filter зөвхөн тодруулга.
export function getSupportTickets(
  accessToken: string,
  filter: { status?: SupportTicketStatus; category?: SupportTicketCategory } = {},
): Promise<SupportTicket[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.category) params.set("category", filter.category);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<SupportTicket[]>(`/support-tickets${qs}`, accessToken);
}

export function getSupportTicket(
  accessToken: string,
  id: string,
): Promise<SupportTicketDetail> {
  return apiFetch<SupportTicketDetail>(`/support-tickets/${id}`, accessToken);
}

// staff-only (apps/api/src/support/support-ticket.controller.ts-ийн
// STATUS_UPDATE_ROLES — OWNER/CUSTOMER орохгүй).
export function updateSupportTicketStatus(
  accessToken: string,
  id: string,
  status: SupportTicketStatus,
): Promise<SupportTicket> {
  return apiFetch<SupportTicket>(`/support-tickets/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function addSupportTicketMessage(
  accessToken: string,
  ticketId: string,
  body: string,
): Promise<SupportMessage> {
  return apiFetch<SupportMessage>(
    `/support-tickets/${ticketId}/messages`,
    accessToken,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}

export function getAuditLogs(
  accessToken: string,
  filter: AuditLogFilter = {},
): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filter.tableName) params.set("tableName", filter.tableName);
  if (filter.action) params.set("action", filter.action);
  if (filter.recordId) params.set("recordId", filter.recordId);
  if (filter.userId) params.set("userId", filter.userId);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.limit) params.set("limit", String(filter.limit));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<AuditLogEntry[]>(`/audit-logs${qs}`, accessToken);
}
