-- ============================================================
-- Phase 3c: Буцаалт/тохиргооны (system_settings, return_requests) RLS.
-- Шинэ SECURITY DEFINER функц НЭМЭЭГҮЙ (docs/adr/005 зарчмын дагуу) —
-- 20260815082257_enable_rls_policies дахь app_current_user_id()/
-- app_has_global_scope()/app_can_manage_branch()-г л дахин ашиглав.
-- ============================================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests FORCE ROW LEVEL SECURITY;

-- ============================================================
-- system_settings: SELECT бүх нэвтэрсэн хэрэглэгчид (жиш: харилцагч ч
-- буцаалт хүсэхээсээ өмнө одоогийн шимтгэлийн хувийг мэдэх ёстой байж
-- болно), UPDATE/INSERT (упсерт) зөвхөн app_has_global_scope()
-- (СУПЕР_АДМИН/OWNER/ALL_BRANCH_MANAGER — даалгаврын "менежерүүд" =
-- global-scope дүрүүд гэсэн тайлбар).
-- ============================================================

CREATE POLICY system_settings_select ON system_settings FOR SELECT
  USING (app_current_user_id() IS NOT NULL);

CREATE POLICY system_settings_insert ON system_settings FOR INSERT
  WITH CHECK (app_has_global_scope());

CREATE POLICY system_settings_update ON system_settings FOR UPDATE
  USING (app_has_global_scope())
  WITH CHECK (app_has_global_scope());

-- ============================================================
-- return_requests: эцэг order_items/orders-той "join-оор шалгах" —
-- даалгаврын шууд заавар (§6.1 матрицаас гаргасан):
--   SELECT: SUPER_ADMIN/ALL_BRANCH_MANAGER (global) = бүх; BRANCH_ADMIN/
--     BRANCH_MANAGER/SALESPERSON = өөрийн салбарынх (orders_select-тэй
--     ижил "app_can_manage_branch() эсвэл SALESPERSON" хэв маяг);
--     CUSTOMER = зөвхөн өөрийн хүссэн мөр.
--   INSERT: CUSTOMER (өөрийн, мөн орьдер ЖИНХЭНЭ өөрийнх нь байх ёстой).
--   UPDATE (зөвшөөрөх/татгалзах): ЗӨВХӨН app_can_manage_branch()/global
--     scope — SALESPERSON УРАН орохгүй (staff л шийдвэр гаргах эрхтэй,
--     даалгаврын шууд заавар).
-- DELETE policy ЗОРИУДАА байхгүй (audit_logs/order_items-тэй адил
-- өөрчлөгдөшгүй түүхэн лог).
-- ============================================================

CREATE POLICY return_requests_select ON return_requests FOR SELECT
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE oi.id = return_requests."orderItemId"
        AND (
          app_can_manage_branch(o."branchId")
          OR EXISTS (
            SELECT 1 FROM user_branch_roles
            WHERE "userId" = app_current_user_id()
              AND "branchId" = o."branchId"
              AND role = 'SALESPERSON'
          )
        )
    )
    OR "requestedByUserId" = app_current_user_id()
  );

CREATE POLICY return_requests_insert ON return_requests FOR INSERT
  WITH CHECK (
    "requestedByUserId" = app_current_user_id()
    AND EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE oi.id = return_requests."orderItemId"
        AND o."customerId" = app_current_user_id()
    )
  );

CREATE POLICY return_requests_update ON return_requests FOR UPDATE
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE oi.id = return_requests."orderItemId"
        AND app_can_manage_branch(o."branchId")
    )
  )
  WITH CHECK (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE oi.id = return_requests."orderItemId"
        AND app_can_manage_branch(o."branchId")
    )
  );
