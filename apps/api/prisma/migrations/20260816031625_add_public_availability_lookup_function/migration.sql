-- ============================================================
-- "Нийтэд харагдах" GET /products/:id endpoint-д зориулсан цонх (peephole).
--
-- Асуудал: inventory_items-ийн SELECT policy зөвхөн
-- app_can_manage_branch(branchId)-той дүрд л зөвшөөрнө (CUSTOMER
-- ХЭЗЭЭ Ч биш — 20260816023759_enable_catalog_inventory_rls-г үзнэ үү),
-- гэвч харилцагч бүтээгдэхүүн харахдаа "бэлэн үү / захиалгаар авах уу"
-- гэдгийг мэдэх ёстой (docs/plan.md §8 Phase 2 checklist).
--
-- Шийдэл: app_can_manage_branch()-тэй ИЖИЛ SECURITY DEFINER зарчмаар
-- RLS-ийг тойрч quantity/override баганыг ЗӨВХӨН серверийн санах ойд
-- уншина — ProductService.findOne нь энэ функцийн үр дүнг
-- computeAvailabilityStatus()-д (inventory-effective.util.ts, ганц
-- эх сурвалж) дамжуулж, ЗӨВХӨН тооцоолсон status/leadDays-ийг л
-- HTTP хариунд оруулна (quantity/branchId бодит утга ХЭЗЭЭ Ч
-- сериалайзлагдахгүй). Иймд бизнес логик (IN_STOCK/PRE_ORDER/
-- OUT_OF_STOCK шийдвэр) энд ДАХИН БИЧИГДЭЭГҮЙ — энэ функц зөвхөн
-- түүхий баганыг буцаана, шийдвэрийг TS тал гаргана.
-- ============================================================

CREATE OR REPLACE FUNCTION app_inventory_snapshot_for_variant(
  p_variant_id text,
  p_branch_id text DEFAULT NULL
) RETURNS TABLE(
  "branchId" text,
  "quantity" integer,
  "preOrderEnabledOverride" boolean,
  "preOrderLeadDaysOverride" integer
)
SECURITY DEFINER SET search_path = public AS $$
  SELECT "branchId", "quantity", "preOrderEnabledOverride", "preOrderLeadDaysOverride"
  FROM inventory_items
  WHERE "variantId" = p_variant_id
    AND (p_branch_id IS NULL OR "branchId" = p_branch_id);
$$ LANGUAGE sql STABLE;
