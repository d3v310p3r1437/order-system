-- ============================================================
-- (2026-08-20, Cart→Checkout→QPay) order.controller.ts-ийн ROUTE_VIEW_ROLES-д
-- CUSTOMER нэмэгдсэний дараа `OrderService.getRoute()`-ийн кэш-бичих алхам
-- (`tx.order.update({ routeDistanceMeters/... })`) CUSTOMER-ийн ХУВЬД
-- "new row violates row-level security policy for table orders" алдаа
-- шидэж байгааг e2e тестээр илрүүлэв — язгуур шалтгаан нь
-- 20260816094000_enable_orders_rls-ийн `orders_update` policy-ийн
-- WITH CHECK: CUSTOMER-ийн UPDATE-г ЗӨВХӨН status='CREATED'→'CANCELLED'
-- шилжилтэд л зөвшөөрдөг (§7 модуль #6 cancel), харин route-ийн кэш бол
-- status-той огт хамааралгүй, статус ХЭВЭЭРЭЭ (жиш: CREATED) байхад л
-- бичигдэх ёстой метадата тул WITH CHECK-ийн аль ч тал таарахгүй.
--
-- Энэ бол ADR 005-ийн "WRITE" ангилалд (20260816095000
-- add_order_inventory_adjustment_function-ийн тайлбарласан "унших/харах
-- боломжтой ч ЯГ ЭНЭ бичилтийг ердийн RLS policy-оор зөвшөөрөх боломжгүй")
-- шинэ тохиолдол — ЯГ тэр функцтэй ижил загвар: зөвшөөрлийг (orders_select-тэй
-- ижил нөхцөл) функц дотроо шалгаад, зөвхөн route кэшийн 3 баганыг л
-- RLS-ийг тойрч бичнэ (Order-ийн бусад ямар ч талбарт (status, totalAmount
-- гэх мэт) хандахгүй тул халдлагын гадаргуу маш нарийн хязгаарлагдмал).
-- ============================================================

CREATE FUNCTION app_cache_order_route(
  p_order_id text,
  p_distance_meters double precision,
  p_duration_seconds double precision,
  p_geometry jsonb
) RETURNS integer
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_authorized boolean;
  v_row_count integer;
BEGIN
  -- orders_select-тэй ЯГ ижил "энэ хэрэглэгч уг Order-ыг харах эрхтэй эсэх"
  -- нөхцөл (20260816094000 migration-ийг үз) — route бол зөвхөн харах
  -- эрхтэй хэн бүхэнд зориулсан ДЕРИВАТИВ (тооцоолсон) утга тул бичих
  -- зөвшөөрлийг харах зөвшөөрөлтэй ижилхэн авав.
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id
      AND (
        app_has_global_scope()
        OR app_can_manage_branch(o."branchId")
        OR EXISTS (
          SELECT 1 FROM user_branch_roles
          WHERE "userId" = app_current_user_id()
            AND "branchId" = o."branchId"
            AND role = 'SALESPERSON'
        )
        OR o."customerId" = app_current_user_id()
      )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'app_cache_order_route: order context not authorized'
      USING ERRCODE = '42501';
  END IF;

  UPDATE orders
  SET "routeDistanceMeters" = p_distance_meters,
      "routeDurationSeconds" = p_duration_seconds,
      "routeGeometry" = p_geometry,
      "updatedAt" = now()
  WHERE id = p_order_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN v_row_count;
END;
$$ LANGUAGE plpgsql;
