-- ============================================================
-- Урамшуулал/купон RLS (docs/plan.md §6.1 матриц "Урамшуулал/купон" мөр,
-- §7 модуль #10). Шинэ helper функц НЭМЭЭГҮЙ (ADR 005 зарчмын дагуу) —
-- 20260815082257_enable_rls_policies дахь app_current_user_id()/
-- app_has_global_scope()-г л дахин ашиглав, зөвхөн inline EXISTS
-- (products_select/categories_select-тэй ижил хэв маяг) нэмсэн.
--
-- §6.1 матриц: SUPER_ADMIN CRUD, OWNER RU, ALL_BRANCH_MANAGER CRUD (бүх),
-- BRANCH_ADMIN R, BRANCH_MANAGER "—", SALESPERSON "—",
-- CUSTOMER R (идэвхтэй) — эдгээр 7 мөрийг ганц app_has_global_scope()-оор
-- илэрхийлэх боломжгүй, учир нь OWNER-д Create/Delete байхгүй (SUPER_ADMIN/
-- ALL_BRANCH_MANAGER-аас ялгаатай) — иймд Create/Delete-д зориулж inline
-- EXISTS (role IN ('SUPER_ADMIN','ALL_BRANCH_MANAGER')) ашиглав, Update-д
-- app_has_global_scope() (яг 3 дүрийг хамарна) хэвээр тохирно.
--
-- CUSTOMER-ийг BRANCH_MANAGER/SALESPERSON-ээс ("—") ялгах арга: CUSTOMER
-- хэрэглэгчид ХЭЗЭЭ Ч user_branch_roles мөр байдаггүй (CLAUDE.md-ийн
-- "resolveUserRoleNames()-ийн CUSTOMER_AUTH fallback" тэмдэглэл,
-- branch.service.ts/order.service.ts-ийн app_public_branches()-ийн ижил
-- нээлт) — тул "user_branch_roles-д ЯМАР Ч мөргүй" гэдгийг "энэ бол
-- CUSTOMER" гэсэн шошго болгон ашиглав.
-- ============================================================

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons FORCE ROW LEVEL SECURITY;

ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- coupons
-- ============================================================

CREATE POLICY coupons_select ON coupons FOR SELECT
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM user_branch_roles WHERE "userId" = app_current_user_id()
      )
      AND "isActive" = true
      AND now() BETWEEN "validFrom" AND "validTo"
    )
  );

CREATE POLICY coupons_insert ON coupons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" IS NULL
        AND role IN ('SUPER_ADMIN', 'ALL_BRANCH_MANAGER')
    )
  );

-- OWNER-д "U" (эрх), гэхдээ "C"/"D" байхгүй тул app_has_global_scope()
-- (SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER гурвыг адилхан хамарна) ЯГ таарна.
CREATE POLICY coupons_update ON coupons FOR UPDATE
  USING (app_has_global_scope())
  WITH CHECK (app_has_global_scope());

CREATE POLICY coupons_delete ON coupons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" IS NULL
        AND role IN ('SUPER_ADMIN', 'ALL_BRANCH_MANAGER')
    )
  );

-- ============================================================
-- coupon_redemptions: зөвхөн SELECT policy — INSERT/UPDATE/DELETE
-- зориудаар БАЙХГҮЙ (typed Prisma-аар бичих боломжгүй болгосон), учир нь
-- энэ хүснэгтэд ЗӨВХӨН доорх app_redeem_coupon() SECURITY DEFINER функц
-- (RLS-ийг бүрэн тойрдог, superuser эзэмшигчээр) л бичих ёстой — ADR 005
-- WRITE ангилал (app_adjust_inventory_for_order()-тэй ижил зарчим:
-- usageCount atomic increment + per-customer давхардал шалгалт хоёуланг
-- нэг SQL функцэд ATOMIC болгож нэгтгэх шаардлагатай, RLS policy-оор энэ
-- "нэг мөрийн lock-оор хамгаалагдсан 2 алхамт" логикийг илэрхийлэх
-- боломжгүй).
-- ============================================================

CREATE POLICY coupon_redemptions_select ON coupon_redemptions FOR SELECT
  USING (
    app_has_global_scope()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id() AND role = 'BRANCH_ADMIN'
    )
    OR "customerId" = app_current_user_id()
  );

-- ============================================================
-- app_redeem_coupon(): checkout-ийн үед CUSTOMER-ийн session-ээр
-- (coupons_update RLS-ээр CUSTOMER-д UPDATE эрхгүй) usageCount-ыг atomic
-- increment хийж, coupon_redemptions мөр бичих ЦОРЫН ГАНЦ зам.
--
-- ⚠️ Race-ийн хамгаалалт (returns PR #7-ийн "claim" загвартай адил
-- зарчим): "SELECT ... FOR UPDATE" нь coupons мөрийг ЗААВАЛ түгжинэ —
-- зэрэг ирсэн 2 дахь дуудлага энэ мөр чөлөөлөгдтөл (RlsMiddleware-ийн
-- бүхэл хүсэлтийн транзакц COMMIT/ROLLBACK хийгдэх хүртэл, ADR 001)
-- БЛОКЛОГДОНО, дараа нь committed usageCount/redemption-ийг харж зөв
-- шийдвэр гаргана — тусдаа "UPDATE ... WHERE usageCount < usageLimit"
-- reject-styled оролдлого (returns/inventory-ийн адил) БИШ, харин
-- "лочоод, унших, шийдэх" хэлбэр сонгосон шалтгаан: per-customer
-- (usageLimitPerCustomer) шалгалт мөн ЯГ ЭНЭ түгжигдсэн цонхон дотор
-- (coupon_redemptions COUNT()) хийгдэх ёстой тул ганц UPDATE...WHERE
-- илэрхийллээр хангалттай биш.
--
-- Функц дотор ЗӨВШӨӨРЛИЙГ ӨӨРӨӨ шалгана (ADR 005 WRITE §2): дуудагч нь
-- p_customer_id ӨӨРӨӨ мөн БОЛОН p_order_id нь ТҮҮНИЙ ЖИНХЭНЭ захиалга байх
-- ёстой (order.service.ts-ийн checkout()-оос, order мөр аль хэдийн
-- withSavepoint дотор үүссэний ДАРАА дуудагдана).
-- ============================================================

CREATE FUNCTION app_redeem_coupon(
  p_coupon_id text,
  p_order_id text,
  p_customer_id text,
  p_discount_amount numeric,
  p_redemption_id text
) RETURNS integer
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usage_limit integer;
  v_usage_count integer;
  v_usage_limit_per_customer integer;
  v_is_active boolean;
  v_valid_from timestamp;
  v_valid_to timestamp;
  v_customer_redemptions integer;
BEGIN
  IF app_current_user_id() IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'app_redeem_coupon: зөвшөөрөлгүй' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM orders WHERE id = p_order_id AND "customerId" = p_customer_id
  ) THEN
    RAISE EXCEPTION 'app_redeem_coupon: захиалга олдсонгүй' USING ERRCODE = '42501';
  END IF;

  SELECT "usageLimit", "usageCount", "usageLimitPerCustomer", "isActive", "validFrom", "validTo"
  INTO v_usage_limit, v_usage_count, v_usage_limit_per_customer, v_is_active, v_valid_from, v_valid_to
  FROM coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_is_active OR now() < v_valid_from OR now() > v_valid_to THEN
    RETURN 0;
  END IF;

  IF v_usage_limit IS NOT NULL AND v_usage_count >= v_usage_limit THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_customer_redemptions
  FROM coupon_redemptions
  WHERE "couponId" = p_coupon_id AND "customerId" = p_customer_id;

  IF v_customer_redemptions >= v_usage_limit_per_customer THEN
    RETURN 0;
  END IF;

  UPDATE coupons SET "usageCount" = "usageCount" + 1, "updatedAt" = now() WHERE id = p_coupon_id;

  INSERT INTO coupon_redemptions (id, "couponId", "orderId", "customerId", "discountAmount")
  VALUES (p_redemption_id, p_coupon_id, p_order_id, p_customer_id, p_discount_amount);

  RETURN 1;
END;
$$ LANGUAGE plpgsql;
