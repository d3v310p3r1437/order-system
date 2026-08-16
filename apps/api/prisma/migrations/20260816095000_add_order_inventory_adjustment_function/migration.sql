-- ============================================================
-- OrderService-ийн checkout()/updateStatus() (CANCELLED) InventoryItem.
-- quantity-г CUSTOMER/SALESPERSON-ийн session-ээр atomic
-- decrement/increment хийх шаардлагатай (§7 модуль #5, #6), гэвч
-- inventory_items_update-г 20260816094000 migration-д join-оор өргөтгөх
-- оролдлого БОДИТООР АЖИЛЛАХГҮЙ болох нь e2e тестээр илэрсэн:
--
-- ⚠️ ЧУХАЛ нээлт (CLAUDE.md-ийн өмнөх "raw UPDATE RETURNING-г тойрно"
-- тэмдэглэлийг ЗАСВАРЛАВ): PostgreSQL-ийн албан ёсны баримт бичигт заасны
-- дагуу UPDATE/DELETE команд (RETURNING байх эсэхээс ҮЛ ХАМААРАН) зорилтот
-- мөрүүдээ тодорхойлохын тулд ТУХАЙН хүснэгтийн SELECT policy-г ЗААВАЛ
-- давхар хангасан байх ёстой — зөвхөн INSERT (RETURNING-гүй үед) л
-- SELECT policy-г бүрэн алгасдаг (audit.interceptor.ts-ийн raw INSERT
-- яг энэ шалтгаанаар ажилладаг). Иймд `EXPLAIN (ANALYZE)`-аар баталгаажуулснаар
-- inventory_items_update-ийн USING нөхцөл өргөтгөсөн ч, Postgres үүнийг
-- inventory_items_SELECT policy (зөвхөн app_can_manage_branch, CUSTOMER/
-- SALESPERSON-г ОРУУЛААГҮЙ)-той AND хийж нэгтгэсэн тул бодит UPDATE 0 мөр
-- олно ("Filter: ((update_using) AND (select_using))" гэдгийг EXPLAIN-аар
-- шууд харсан).
--
-- SELECT policy-г мөн адил өргөтгөх нь "нөөцийн тоо нууц" (§6.1, ADR 005)
-- шаардлагыг зөрчинө (CUSTOMER GET /inventory-items-ээр quantity шууд
-- харах боломжтой болно) тул боломжгүй.
--
-- Шийдэл: "READ+redact"-д зориулагдсан ADR 005-ийн хамрах хүрээнээс
-- ухамсартайгаар ГАДУУР (WRITE) гэдгийг тэмдэглэсээр, ижил зарчмаар
-- (зөвхөн superuser "app" эзэмшигчтэй, тодорхой хязгаарлагдмал зорилготой,
-- дотроо ӨӨРӨӨ зөвшөөрлийн шалгалт хийдэг) НАРИЙН SECURITY DEFINER функц
-- нэмэв — учир нь UPDATE/DELETE-ийн хувьд "унших эрхгүй ч бичих эрхтэй"
-- гэдгийг ердийн RLS policy-оор ЗАРЧМЫН хувьд илэрхийлэх боломжгүй
-- (дээрх тайлбар), функц дотор зөвшөөрлийг шалгаад RLS-ийг бүрэн тойрч
-- бичих нь цорын ганц зам.
-- ============================================================

CREATE FUNCTION app_adjust_inventory_for_order(
  p_order_id text,
  p_variant_id text,
  p_branch_id text,
  p_delta integer
) RETURNS integer
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_authorized boolean;
  v_row_count integer;
BEGIN
  -- Зөвшөөрлийг ЭНД (функц дотор) шалгана: дуудагч нь тухайн Order-ыг
  -- удирдах эрхтэй (global/branch-manage) ЭСВЭЛ энэ Order-ын ӨӨРСДИЙН нь
  -- (CUSTOMER) ЭСВЭЛ ӨӨРИЙН САЛБАРЫНХ нь (SALESPERSON) байх ёстой, мөн
  -- p_variant_id нь энэ Order-д ЖИНХЭНЭ захиалагдсан байх ёстой
  -- (order_items-ээр join) — санамсаргүй variantId/branchId хос дамжуулж
  -- дурын inventory мөр өөрчлөхөөс сэргийлнэ.
  SELECT EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi."orderId" = o.id
    WHERE o.id = p_order_id
      AND oi."variantId" = p_variant_id
      AND o."branchId" = p_branch_id
      AND (
        app_has_global_scope()
        OR app_can_manage_branch(o."branchId")
        OR o."customerId" = app_current_user_id()
        OR EXISTS (
          SELECT 1 FROM user_branch_roles
          WHERE "userId" = app_current_user_id()
            AND "branchId" = o."branchId"
            AND role = 'SALESPERSON'
        )
      )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'app_adjust_inventory_for_order: order/inventory context not authorized'
      USING ERRCODE = '42501';
  END IF;

  -- inventory_items_quantity_nonneg CHECK constraint (сөрөг тоо руу орвол)
  -- энд ЭНГИЙН Postgres алдаа хэвээр шидэгдэнэ — OrderService үүнийг
  -- isCheckConstraintViolation()-оор барьж 409 OUT_OF_STOCK болгоно.
  UPDATE inventory_items
  SET quantity = quantity + p_delta, "updatedAt" = now()
  WHERE "variantId" = p_variant_id AND "branchId" = p_branch_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN v_row_count;
END;
$$ LANGUAGE plpgsql;
