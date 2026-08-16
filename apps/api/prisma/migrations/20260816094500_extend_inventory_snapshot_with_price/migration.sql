-- ============================================================
-- OrderService.checkout() нь unitPriceSnapshot тооцохын тулд (§7 модуль #5:
-- "variant бүрийн resolveEffectivePrice()-аар unitPriceSnapshot тооцож")
-- InventoryItem.branchPrice override-ыг мэдэх ёстой, гэвч CUSTOMER
-- inventory_items-ийг шууд SELECT хийх эрхгүй (docs/adr/005) — яг адилхан
-- "нийтэд харагдах" READ-redact асуудал тул ШИНЭ функц зохиохгүй, ADR
-- 005-ийн зарчмын дагуу (4-р зүйл: "байгааг нь дахин ашигла эсвэл
-- параметржүүлж өргөт") 20260816031625-ийн app_inventory_snapshot_for_variant()-г
-- өргөтгөв (branchPrice багана нэмэв). Буцаах баганын тоо өөрчлөгдсөн тул
-- CREATE OR REPLACE биш DROP + дахин CREATE шаардлагатай (Postgres:
-- функцийн буцаах TABLE бүтэц өөрчлөгдвөл REPLACE зөвшөөрдөггүй).
-- ============================================================

DROP FUNCTION IF EXISTS app_inventory_snapshot_for_variant(text, text);

CREATE FUNCTION app_inventory_snapshot_for_variant(
  p_variant_id text,
  p_branch_id text DEFAULT NULL
) RETURNS TABLE(
  "branchId" text,
  "quantity" integer,
  "branchPrice" numeric,
  "preOrderEnabledOverride" boolean,
  "preOrderLeadDaysOverride" integer
)
SECURITY DEFINER SET search_path = public AS $$
  SELECT "branchId", "quantity", "branchPrice", "preOrderEnabledOverride", "preOrderLeadDaysOverride"
  FROM inventory_items
  WHERE "variantId" = p_variant_id
    AND (p_branch_id IS NULL OR "branchId" = p_branch_id);
$$ LANGUAGE sql STABLE;
