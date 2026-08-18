-- ============================================================
-- Phase 2, Хэсэг A: product_images RLS policy.
--
-- Шинэ SECURITY DEFINER функц НЭМЭЭГҮЙ — 20260815082257_enable_rls_policies
-- дахь app_current_user_id() / app_has_global_scope()-г л дахин ашигласан
-- (ADR 005-ийн "өмнө нь бичигдсэн ижил зорилготой функц байхгүй эсэхийг
-- эхлээд шалга" зарчим).
--
-- §6.1 матриц "Бүтээгдэхүүн/каталог" мөрийг л дахин ашигласан: зураг нь
-- Product-ийн бүтцийн (structural) хэсэг тул products_insert/
-- products_delete policy-той ЯГ ижил дүрүүдэд (global scope эсвэл
-- BRANCH_ADMIN) CUD зөвшөөрнө — UPDATE endpoint энэ даалгаварт
-- байхгүй (зөвхөн upload/delete) тул UPDATE policy зориудаа нэмээгүй,
-- Postgres анхдагчаар (policy байхгүй бол) UPDATE-ийг бүрэн хориглоно.
-- ============================================================

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;

CREATE POLICY product_images_select ON product_images FOR SELECT
  USING (app_current_user_id() IS NOT NULL);

CREATE POLICY product_images_insert ON product_images FOR INSERT
  WITH CHECK (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
  );

CREATE POLICY product_images_delete ON product_images FOR DELETE
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
  );
