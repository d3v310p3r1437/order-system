-- ============================================================
-- Сэтгэгдэл/үнэлгээ (docs/plan.md §7 модуль #11) RLS. Шинэ SECURITY
-- DEFINER функц НЭМЭЭГҮЙ (ADR 005 зарчмын дагуу) — 20260815082257_
-- enable_rls_policies дахь app_current_user_id()/app_has_global_scope()-г
-- л дахин ашиглав, INSERT-ийн EXISTS join хэв маяг
-- return_requests_insert-ийн (20260817130500_enable_returns_settings_rls)
-- ЯГ ижил загварыг дахин ашигласан.
--
-- Даалгаврын шууд заавар:
--   SELECT: бүх нэвтэрсэн хэрэглэгчид (каталогтой ижил зарчим).
--   INSERT: CUSTOMER, WITH CHECK-д "customerId=app_current_user_id() БА
--     тухайн productId-той OrderItem→ProductVariant→Product join-оор
--     COMPLETED статустай захиалга байгаа" (EXISTS) — order_items_select/
--     orders_select RLS (аль хэдийн CUSTOMER-д ӨӨРИЙН захиалгаа харах
--     эрх өгдөг) энэ дэд query-д мөн адил хэрэгждэг тул шинэ функц
--     шаардлагагүй.
--   UPDATE: зөвхөн ӨӨРИЙН (customerId = app_current_user_id()).
--   DELETE: ӨӨРИЙН, ЭСВЭЛ app_has_global_scope() (модераци — admin-web
--     "/reviews" дэлгэцийн "Устгах" товч).
-- ============================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY reviews_select ON reviews FOR SELECT
  USING (app_current_user_id() IS NOT NULL);

CREATE POLICY reviews_insert ON reviews FOR INSERT
  WITH CHECK (
    "customerId" = app_current_user_id()
    AND EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      JOIN product_variants pv ON pv.id = oi."variantId"
      WHERE pv."productId" = reviews."productId"
        AND o."customerId" = app_current_user_id()
        AND o.status = 'COMPLETED'
    )
  );

CREATE POLICY reviews_update ON reviews FOR UPDATE
  USING ("customerId" = app_current_user_id())
  WITH CHECK ("customerId" = app_current_user_id());

-- Модераци: app_has_global_scope() (SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER)
-- дурын хэрэглэгчийн сэтгэгдлийг устгаж болно — admin-web "/reviews"
-- дэлгэц дээрх ЦОРЫН ГАНЦ "устгах" зорилготой мутаци (Category/Product-ийн
-- isActive-toggle зарчмаас ЯЛГААТАЙ, реал DELETE — эндхийн "устгах" бол
-- контентийн модераци, бизнес объектын амьдралын мөчлөгийн soft-deactivate
-- биш).
CREATE POLICY reviews_delete ON reviews FOR DELETE
  USING (
    "customerId" = app_current_user_id()
    OR app_has_global_scope()
  );
