-- ============================================================
-- Phase 2, 1-р хэсэг: Каталог (categories/products/product_variants)
-- ба агуулах (inventory_items) RLS policy.
--
-- Шинэ SECURITY DEFINER функц НЭМЭЭГҮЙ — 20260815082257_enable_rls_policies
-- дахь app_current_user_id() / app_has_global_scope() /
-- app_accessible_branch_ids() / app_can_manage_branch()-г дахин ашиглав.
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;

-- ============================================================
-- categories / products / product_variants
-- §6.1 матриц "Бүтээгдэхүүн/каталог" мөр:
--   SUPER_ADMIN=CRUD, OWNER=R, ALL_BRANCH_MANAGER=CRUD, BRANCH_ADMIN=CRUD
--   (өөрийн салбарын үнэ), BRANCH_MANAGER=RU, SALESPERSON=R, CUSTOMER=R.
-- Каталог нь салбараар тусгаарлагддаггүй (нэг нийтлэг каталог) тул
-- app_can_manage_branch(branchId) шууд хэрэглэх боломжгүй — BRANCH_ADMIN/
-- BRANCH_MANAGER эсэхийг (аль ч салбарт харьяалагдсан эсэхээс үл хамааран)
-- зөвхөн ӨӨРИЙН мөрөөр нь шалгана (ubr_select policy "userId =
-- app_current_user_id()" гэсэн нөхцөлөөр өөрийн мөрөө үргэлж уншиж чадна —
-- тиймээс шинэ SECURITY DEFINER функц шаардлагагүй, recursion-той
-- мөргөлдөхгүй). Энгийн байлгахын тулд Category-г зөвхөн SUPER_ADMIN/
-- ALL_BRANCH_MANAGER-д удирдуулж (бүтцийн шинж чанартай тул), харин
-- Product/ProductVariant-ийн UPDATE-д BRANCH_ADMIN/BRANCH_MANAGER-г
-- нэмж зөвшөөрсөн (§6.1-ийн "CRUD (өөрийн салбарын үнэ)"/"RU"-г нэг
-- зорилготой болгож хялбаршуулав) — Гацсан тохиолдолд өөрөө шийдсэн
-- энгийн болгол.
-- ============================================================

CREATE POLICY categories_select ON categories FOR SELECT
  USING (app_current_user_id() IS NOT NULL);

CREATE POLICY categories_insert ON categories FOR INSERT
  WITH CHECK (app_has_global_scope());

CREATE POLICY categories_update ON categories FOR UPDATE
  USING (app_has_global_scope())
  WITH CHECK (app_has_global_scope());

CREATE POLICY categories_delete ON categories FOR DELETE
  USING (app_has_global_scope());

CREATE POLICY products_select ON products FOR SELECT
  USING (app_current_user_id() IS NOT NULL);

CREATE POLICY products_insert ON products FOR INSERT
  WITH CHECK (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
  );

CREATE POLICY products_update ON products FOR UPDATE
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND role IN ('BRANCH_ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND role IN ('BRANCH_ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY products_delete ON products FOR DELETE
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
  );

CREATE POLICY product_variants_select ON product_variants FOR SELECT
  USING (app_current_user_id() IS NOT NULL);

CREATE POLICY product_variants_insert ON product_variants FOR INSERT
  WITH CHECK (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
  );

CREATE POLICY product_variants_update ON product_variants FOR UPDATE
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND role IN ('BRANCH_ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND role IN ('BRANCH_ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY product_variants_delete ON product_variants FOR DELETE
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
  );

-- ============================================================
-- inventory_items
-- Даалгаврын шууд заавар: "SELECT/CRUD зөвхөн app_can_manage_branch(branchId)
-- эсвэл global scope-той дүрд" — app_can_manage_branch() өөрөө дотроо
-- app_has_global_scope()-г ХЭДИЙНЭ шалгадаг (20260815082257 migration-ийг
-- үзнэ үү) тул нэмэлт OR-гүйгээр л хангалттай. Харилцагч БОЛОН худалдагч
-- (SALESPERSON) аль аль нь app_can_manage_branch()-ийн нөхцөл (BRANCH_ADMIN/
-- BRANCH_MANAGER эсвэл global) хангахгүй тул автоматаар хасагдана —
-- "Харилцагч ХАРАХГҮЙ" шаардлагыг давхар хангана.
-- ============================================================

CREATE POLICY inventory_items_select ON inventory_items FOR SELECT
  USING (app_can_manage_branch("branchId"));

CREATE POLICY inventory_items_insert ON inventory_items FOR INSERT
  WITH CHECK (app_can_manage_branch("branchId"));

CREATE POLICY inventory_items_update ON inventory_items FOR UPDATE
  USING (app_can_manage_branch("branchId"))
  WITH CHECK (app_can_manage_branch("branchId"));

CREATE POLICY inventory_items_delete ON inventory_items FOR DELETE
  USING (app_can_manage_branch("branchId"));
