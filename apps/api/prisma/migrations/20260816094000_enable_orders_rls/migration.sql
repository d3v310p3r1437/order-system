-- ============================================================
-- Phase 3a: Захиалгын (orders/order_items) RLS policy.
--
-- Шинэ SECURITY DEFINER функц НЭМЭЭГҮЙ (docs/adr/005 зарчмын дагуу) —
-- 20260815082257_enable_rls_policies дахь app_current_user_id()/
-- app_has_global_scope()/app_can_manage_branch()-г л дахин ашиглав.
-- §6.1 матриц "Захиалга" мөр:
--   SUPER_ADMIN/ALL_BRANCH_MANAGER = CRUD (бүх)
--   BRANCH_ADMIN/BRANCH_MANAGER    = CRUD (өөрийн салбар)
--   SALESPERSON                    = RU (өөрийн салбар, статус л)
--   CUSTOMER                       = CR (өөрийн), + зөвхөн CREATED→CANCELLED
-- ============================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;

CREATE POLICY orders_select ON orders FOR SELECT
  USING (
    app_has_global_scope()
    OR app_can_manage_branch("branchId")
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" = orders."branchId"
        AND role = 'SALESPERSON'
    )
    OR "customerId" = app_current_user_id()
  );

-- CUSTOMER зөвхөн ӨӨРИЙН нэрийн өмнөөс, status='CREATED' мөр л шууд
-- үүсгэж болно (checkout нь үргэлж CREATED-аар эхэлдэг тул OrderService-ийн
-- бизнес логиктой давхар нийцнэ) — staff (branch/global scope) дурын
-- статустай захиалга гараар үүсгэж болно (жиш: утсаар авсан захиалга).
CREATE POLICY orders_insert ON orders FOR INSERT
  WITH CHECK (
    app_has_global_scope()
    OR app_can_manage_branch("branchId")
    OR ("customerId" = app_current_user_id() AND status = 'CREATED')
  );

-- CUSTOMER-ийн UPDATE (cancel) нь ЗӨВХӨН status='CREATED' мөрөнд, шинэ
-- утга нь ЗӨВХӨН 'CANCELLED' үед л зөвшөөрөгдөнө (USING — өмнөх төлөв,
-- WITH CHECK — шинэ төлөв) — даалгаврын шууд заавар. SALESPERSON статус
-- л (application DTO-оор branchId/customerId зэргийг өөрчлөхгүй) шинэчилж
-- болно.
CREATE POLICY orders_update ON orders FOR UPDATE
  USING (
    app_has_global_scope()
    OR app_can_manage_branch("branchId")
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" = orders."branchId"
        AND role = 'SALESPERSON'
    )
    OR ("customerId" = app_current_user_id() AND status = 'CREATED')
  )
  WITH CHECK (
    app_has_global_scope()
    OR app_can_manage_branch("branchId")
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" = orders."branchId"
        AND role = 'SALESPERSON'
    )
    OR ("customerId" = app_current_user_id() AND status = 'CANCELLED')
  );

CREATE POLICY orders_delete ON orders FOR DELETE
  USING (app_has_global_scope() OR app_can_manage_branch("branchId"));

-- ============================================================
-- order_items: "эцэг Order-той адил дүрмээр (join-оор шалгах)" —
-- даалгаврын шууд заавар. UPDATE policy ЗОРИУДАА байхгүй (audit_logs-ын
-- шиг өөрчлөгдөшгүй түүхэн мөр — unitPriceSnapshot захиалга үүсэх
-- мөчийн үнэ, ХЭЗЭЭ Ч дараа нь засагдахгүй) — Postgres анхдагчаар UPDATE-г
-- бүрэн хориглоно. DELETE policy зөвхөн Order cascade delete (orders_delete
-- зөвшөөрсөн үед FK ON DELETE CASCADE)-ийг дэмжихийн тулд байгаа —
-- CUSTOMER/SALESPERSON өөрсдөө order_items устгах ёсгүй тул тэдэнд DELETE
-- зөвшөөрөгдөөгүй.
-- ============================================================

CREATE POLICY order_items_select ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items."orderId"
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
    )
  );

-- Checkout нь Order-ыг эхэлж (status=CREATED) үүсгэсний дараа OrderItem-үүдийг
-- нэмдэг тул CUSTOMER-ийн хувьд эцэг Order нь ӨӨРИЙНХ, status='CREATED'
-- байхыг л шаардана.
CREATE POLICY order_items_insert ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items."orderId"
        AND (
          app_has_global_scope()
          OR app_can_manage_branch(o."branchId")
          OR (o."customerId" = app_current_user_id() AND o.status = 'CREATED')
        )
    )
  );

CREATE POLICY order_items_delete ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items."orderId"
        AND (app_has_global_scope() OR app_can_manage_branch(o."branchId"))
    )
  );

-- ⚠️ inventory_items-ийн RLS policy-г ЭНД ӨӨРЧЛӨӨГҮЙ — CUSTOMER/SALESPERSON-д
-- checkout/cancel-ийн үед InventoryItem.quantity өөрчлөх шаардлага гарсан ч
-- (§7 модуль #5, #6) inventory_items_update-г өргөтгөх зарчмыг турших явцад
-- ЭНД биш, 20260816095000_add_order_inventory_adjustment_function
-- migration-д тайлбарласан ШАЛТГААНААР шинэ SECURITY DEFINER ФУНКЦ
-- (app_adjust_inventory_for_order) ашиглахаар шийдсэн — уг migration-ийг үз.
