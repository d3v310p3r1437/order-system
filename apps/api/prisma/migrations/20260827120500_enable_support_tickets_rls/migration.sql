-- ============================================================
-- Харилцагчийн үйлчилгээ (docs/plan.md §7 модуль #13) RLS. Шинэ SECURITY
-- DEFINER функц НЭМЭЭГҮЙ (ADR 005 зарчмын дагуу) — 20260815082257_
-- enable_rls_policies дахь app_current_user_id()/app_has_global_scope()/
-- app_can_manage_branch()-г л дахин ашиглав, SALESPERSON-ийн inline EXISTS
-- шалгалт return_requests_select-ийн (20260817130500) ЯГ ижил загварыг
-- дахин ашигласан.
--
-- Даалгаврын шууд заавар (§6.1 матрицад тусгайлан мөр байхгүй тул код
-- болгов):
--   support_tickets SELECT/UPDATE(status): SUPER_ADMIN/ALL_BRANCH_MANAGER
--     бүх; OWNER зөвхөн R бүх (UPDATE-д ОРОХГҮЙ — app_has_global_scope()
--     нь SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER-г ялгаагүй хамардаг тул
--     UPDATE-д coupons_insert/delete-тэй (20260821130000) ЯГ ижил
--     шалтгаанаар inline "role IN ('SUPER_ADMIN','ALL_BRANCH_MANAGER')
--     AND branchId IS NULL" ашиглав); BRANCH_ADMIN/BRANCH_MANAGER/
--     SALESPERSON зөвхөн orderId IS NOT NULL БА тэр Order-ийн branchId нь
--     app_can_manage_branch() (BRANCH_ADMIN/BRANCH_MANAGER-г л хамардаг
--     тул SALESPERSON-д зориулж дэд EXISTS нэмэлт); CUSTOMER CR зөвхөн
--     customerId=app_current_user_id() (UPDATE(status)-д CUSTOMER
--     ОРОХГҮЙ — статус солих нь зөвхөн staff-ийн эрх, task-ийн API
--     тодорхойлолт "PATCH /support-tickets/:id (status, staff-only)").
--   support_tickets INSERT: CUSTOMER, өөрийн (customerId=
--     app_current_user_id()) БОЛОН orderId өгөгдсөн бол тэр Order ЖИНХЭНЭ
--     өөрийнх нь байх ёстой (return_requests_insert-тэй ижил нэмэлт
--     баталгаа).
--   support_messages SELECT/INSERT: эцэг support_tickets-ийн ЯГ ИЖИЛ
--     харагдах нөхцөлөөр (ticketId→support_tickets join). CUSTOMER зөвхөн
--     ticket.status != 'CLOSED' үед л мессеж нэмж болно (staff-д ийм
--     хязгаарлалт байхгүй — task-ийн шууд заавар зөвхөн CUSTOMER-д
--     хамаарна). Мессежийн senderId ЗААВАЛ app_current_user_id()-тэй
--     тохирно (бусдын нэрийн өмнөөс бичихээс сэргийлнэ).
-- DELETE policy аль алинд нь ЗОРИУДАА байхгүй (audit_logs/order_items/
-- return_requests-тэй адил өөрчлөгдөшгүй түүхэн чат бичлэг).
-- ============================================================

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_select ON support_tickets FOR SELECT
  USING (
    app_has_global_scope()
    OR (
      "orderId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = support_tickets."orderId"
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
    )
    OR "customerId" = app_current_user_id()
  );

CREATE POLICY support_tickets_insert ON support_tickets FOR INSERT
  WITH CHECK (
    "customerId" = app_current_user_id()
    AND (
      "orderId" IS NULL
      OR EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = support_tickets."orderId"
          AND o."customerId" = app_current_user_id()
      )
    )
  );

CREATE POLICY support_tickets_update ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" IS NULL
        AND role IN ('SUPER_ADMIN', 'ALL_BRANCH_MANAGER')
    )
    OR (
      "orderId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = support_tickets."orderId"
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
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" IS NULL
        AND role IN ('SUPER_ADMIN', 'ALL_BRANCH_MANAGER')
    )
    OR (
      "orderId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = support_tickets."orderId"
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
    )
  );

CREATE POLICY support_messages_select ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages."ticketId"
        AND (
          app_has_global_scope()
          OR (
            t."orderId" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM orders o
              WHERE o.id = t."orderId"
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
          )
          OR t."customerId" = app_current_user_id()
        )
    )
  );

CREATE POLICY support_messages_insert ON support_messages FOR INSERT
  WITH CHECK (
    "senderId" = app_current_user_id()
    AND EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages."ticketId"
        AND (
          app_has_global_scope()
          OR (
            t."orderId" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM orders o
              WHERE o.id = t."orderId"
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
          )
          OR (
            t."customerId" = app_current_user_id()
            AND t.status != 'CLOSED'
          )
        )
    )
  );
