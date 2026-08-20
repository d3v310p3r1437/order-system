-- ============================================================
-- (2026-08-20, Cart→Checkout→QPay) OrderService.getRoute()-ийг CUSTOMER-д
-- нээхэд (order.controller.ts-ийн ROUTE_VIEW_ROLES-д CUSTOMER нэмэгдэв —
-- Mobile OrderTrackingScreen-д DELIVERY захиалгын замыг харуулах ёстой)
-- энэ функц CUSTOMER-ийн хувьд `tx.branch.findUnique()`-ийг (branches_select
-- RLS CUSTOMER-д ХЭЗЭЭ Ч мөр буцаадаггүй тул) BRANCH_LOCATION_MISSING
-- (400)-ээр ХУДАЛ татгалзуулж байгааг бодит e2e тестээр илрүүлэв (энэ бол
-- 20260820120000-ийн "GET /branches CUSTOMER-д ХЭЗЭЭ Ч мөр буцаадаггүй"
-- нээлттэй ЯГ ижил язгуур шалтгаан, өөр endpoint дээр давтагдсан).
--
-- Салбарын байршил (latitude/longitude) нууц МЭДЭЭЛЭЛ БИШ — дэлгүүрийн
-- байршил PICKUP захиалгад ч харилцагчид харагдах ёстой зүйл (inventory
-- quantity-ийн адил "нууц" биш) тул ADR 005-ийн "READ-redact" зарчмаар
-- app_public_branches()-г (DROP+CREATE, буцаах TABLE бүтэц өөрчлөгдсөн тул
-- 20260816094500-ийн адил REPLACE боломжгүй) 2 талаар өргөтгөв:
--   1. latitude/longitude багана нэмэв.
--   2. Сонголтот `p_branch_id` параметр нэмэв (NULL бол өмнөх шигээ бүх
--      идэвхтэй салбарыг буцаана — BranchService.findAll()-д өөрчлөлт
--      шаардлагагүй; тодорхой ID өгвөл зөвхөн тэр мөрийг, app_inventory_
--      snapshot_for_variant()-ийн p_branch_id-тэй ЯГ ижил загвар).
-- ============================================================

DROP FUNCTION IF EXISTS app_public_branches();

CREATE FUNCTION app_public_branches(p_branch_id text DEFAULT NULL) RETURNS TABLE(
  "id" text,
  "name" text,
  "address" text,
  "district" text,
  "latitude" double precision,
  "longitude" double precision
)
SECURITY DEFINER SET search_path = public AS $$
  SELECT "id", "name", "address", "district", "latitude", "longitude"
  FROM branches
  WHERE "isActive" = true
    AND (p_branch_id IS NULL OR "id" = p_branch_id)
  ORDER BY "name" ASC;
$$ LANGUAGE sql STABLE;
