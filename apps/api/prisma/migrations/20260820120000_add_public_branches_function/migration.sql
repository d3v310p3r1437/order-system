-- ============================================================
-- §7 модуль #5 (Сагс/захиалга): Mobile-ийн BranchSelectionScreen
-- (CUSTOMER) захиалга хийхийн өмнө идэвхтэй салбаруудын жагсаалтыг
-- харах ёстой. Гэвч `branches_select` RLS policy (20260815082257
-- migration) `app_accessible_branch_ids()`-д тулгуурладаг бөгөөд энэ
-- функц ЗӨВХӨН `user_branch_roles` мөртэй хэрэглэгчид (staff)-д
-- зориулагдсан — CUSTOMER-д ХЭЗЭЭ Ч `user_branch_roles` мөр байхгүй
-- (auth-customer/register CUSTOMER-ийг зөвхөн authProvider=CUSTOMER_AUTH-аар
-- илэрхийлдэг) тул `GET /branches` CUSTOMER-д үргэлж ХООСОН массив
-- буцаадаг байсныг Android emulator дээрх бодит турших үед олж
-- илрүүлэв (docs/adr/005-ийн "READ-redact" ижил зарчим, product/product.service.ts-ийн
-- app_inventory_snapshot_for_variant()-той адилхан "цонх" функц) —
-- зөвхөн НИЙТЭД аюулгүй баганыг (id/name/address/district) идэвхтэй
-- салбаруудаас буцаана.
-- ============================================================

CREATE FUNCTION app_public_branches() RETURNS TABLE(
  "id" text,
  "name" text,
  "address" text,
  "district" text
)
SECURITY DEFINER SET search_path = public AS $$
  SELECT "id", "name", "address", "district"
  FROM branches
  WHERE "isActive" = true
  ORDER BY "name" ASC;
$$ LANGUAGE sql STABLE;
