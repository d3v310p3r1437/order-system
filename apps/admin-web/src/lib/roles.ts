// §Даалгавар архитектурын зарчим: эдгээр жагсаалт нь ЗӨВХӨН UX гоёлт
// (товч харуулах/нуух) — жинхэнэ хамгаалалт backend-ийн RBAC guard
// (@Roles()) + RLS. Тиймээс доорх утгууд нь backend-ийн @Roles()
// decorator-уудтай ЯГ ТААРАХ ёстой:
// - CATEGORY_WRITE_ROLES ↔ apps/api/src/catalog/category/category.controller.ts
// - PRODUCT_CREATE_ROLES/PRODUCT_UPDATE_ROLES ↔ .../product/product.controller.ts
// - VARIANT_CREATE_ROLES/VARIANT_UPDATE_ROLES ↔ .../product-variant/product-variant.controller.ts
// - INVENTORY_WRITE_ROLES ↔ apps/api/src/inventory/inventory.controller.ts (WRITE_ROLES)
export const CATEGORY_WRITE_ROLES = ["SUPER_ADMIN", "ALL_BRANCH_MANAGER"];

export const PRODUCT_CREATE_ROLES = [
  "SUPER_ADMIN",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
];
export const PRODUCT_UPDATE_ROLES = [
  "SUPER_ADMIN",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
  "BRANCH_MANAGER",
];

export const VARIANT_CREATE_ROLES = PRODUCT_CREATE_ROLES;
export const VARIANT_UPDATE_ROLES = PRODUCT_UPDATE_ROLES;

// ↔ apps/api/src/catalog/product-image/product-image.controller.ts
// (IMAGE_WRITE_ROLES) — PRODUCT_CREATE_ROLES-той яг ижил (BRANCH_MANAGER
// ороогүй, зураг upload/устгах "structural" үйлдэл гэж үзсэн).
export const PRODUCT_IMAGE_WRITE_ROLES = PRODUCT_CREATE_ROLES;

export const INVENTORY_WRITE_ROLES = [
  "SUPER_ADMIN",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
  "BRANCH_MANAGER",
];

// ↔ apps/api/src/orders/order.service.ts (STAFF_STATUS_ROLES) — OWNER-д
// зөвхөн R байдаг тул орохгүй. CUSTOMER-ийн cancel-only зам admin-web-д
// хамаагүй (харилцагч энэ веб самбарыг ашиглахгүй).
export const ORDER_STATUS_UPDATE_ROLES = [
  "SUPER_ADMIN",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
  "BRANCH_MANAGER",
  "SALESPERSON",
];

// ↔ apps/api/src/returns/return-request.controller.ts (REVIEW_ROLES) —
// SALESPERSON ЗОРИУДАА ороогүй (харах эрхтэй ч зөвшөөрөх/татгалзах эрхгүй,
// return_requests_update RLS-тэй тохирно).
export const RETURN_REVIEW_ROLES = [
  "SUPER_ADMIN",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
  "BRANCH_MANAGER",
];

// ↔ apps/api/src/settings/system-setting.controller.ts (RETURN_FEE_WRITE_ROLES)
// — system_settings_update RLS (app_has_global_scope())-тэй тохирно.
export const RETURN_FEE_WRITE_ROLES = ["SUPER_ADMIN", "OWNER", "ALL_BRANCH_MANAGER"];

// ↔ apps/api/src/reports/report.controller.ts (REPORT_VIEW_ROLES) — §6.1
// матрицын "Тайлан/аналитик" мөр: SALESPERSON/CUSTOMER-д "—" тул ороогүй.
export const REPORT_VIEW_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
  "BRANCH_MANAGER",
];

// ↔ apps/api/src/reports/report.controller.ts (BRANCH_COMPARISON_ROLES) —
// зөвхөн "R (бүх)" гурван дүрд (RETURN_FEE_WRITE_ROLES-той ижил жагсаалт
// ч өөр зорилготой тул тусад нь зарлав).
export const BRANCH_COMPARISON_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ALL_BRANCH_MANAGER",
];

// ↔ apps/api/src/coupons/coupon.controller.ts (COUPON_CREATE_ROLES/
// COUPON_UPDATE_ROLES) — §6.1 матриц "Урамшуулал/купон" мөр: OWNER-д
// зөвхөн R/U байдаг тул CREATE-д ороогүй, BRANCH_ADMIN/BRANCH_MANAGER/
// SALESPERSON аль алинд нь "—"/"R"-ээс цааш эрхгүй.
export const COUPON_CREATE_ROLES = ["SUPER_ADMIN", "ALL_BRANCH_MANAGER"];
export const COUPON_UPDATE_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ALL_BRANCH_MANAGER",
];

// ↔ apps/api/src/staff/staff.controller.ts (STAFF_MANAGE_ROLES) —
// BRANCH_MANAGER ЗОРИУДАА ороогүй (ажилтан удирдах эрхгүй, migration
// add_staff_management_functions-ийн app_can_manage_staff() коммент).
export const STAFF_MANAGE_ROLES = [
  "SUPER_ADMIN",
  "ALL_BRANCH_MANAGER",
  "BRANCH_ADMIN",
];

// ↔ apps/api/src/audit/audit-log.controller.ts (AUDIT_LOG_VIEW_ROLES) —
// зөвхөн глобал-эрхийн 3 дүр, учир нь AuditInterceptor branchId-г ХЭЗЭЭ Ч
// populate хийдэггүй тул branch-scoped дүрд ямар ч тохиолдолд хоосон
// жагсаалт л харагдах байсан (audit-log.controller.ts-ийн коммент).
export const AUDIT_LOG_VIEW_ROLES = ["SUPER_ADMIN", "OWNER", "ALL_BRANCH_MANAGER"];

// ↔ apps/api/src/reviews/review.controller.ts (REVIEW_MODERATION_ROLES) —
// §7 модуль #11-д §6.1 матрицад тусгайлан мөр байхгүй тул audit-log-той
// (AUDIT_LOG_VIEW_ROLES) ижил "3 глобал-эрхийн дүр" загварыг ашигласан.
export const REVIEW_MODERATION_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ALL_BRANCH_MANAGER",
];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Супер админ",
  OWNER: "Дэлгүүрийн эзэн",
  ALL_BRANCH_MANAGER: "Бүх-салбарын менежер",
  BRANCH_ADMIN: "Салбарын админ",
  BRANCH_MANAGER: "Салбарын менежер",
  SALESPERSON: "Худалдагч",
  CUSTOMER: "Харилцагч",
};

export function hasAnyRole(
  userRoles: readonly string[],
  allowedRoles: readonly string[],
): boolean {
  return allowedRoles.some((role) => userRoles.includes(role));
}
