-- ============================================================
-- Branch: байршлын нэмэлт талбар (district/latitude/longitude) —
-- өгөгдөлгүй (nullable) тул backfill шаардлагагүй.
-- ============================================================
ALTER TABLE "branches" ADD COLUMN "district" TEXT;
ALTER TABLE "branches" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "branches" ADD COLUMN "longitude" DOUBLE PRECISION;

-- ============================================================
-- categories: slug/description/displayOrder/isActive
-- slug NOT NULL UNIQUE тул одоо байгаа мөрүүдэд эхлээд NULL-аар нэмээд,
-- id-ээр backfill хийж (id аль хэдийн unique тул давхцахгүй баталгаатай),
-- дараа нь NOT NULL болгоно.
-- ============================================================
ALTER TABLE "categories" ADD COLUMN "slug" TEXT;
ALTER TABLE "categories" ADD COLUMN "description" TEXT;
ALTER TABLE "categories" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "categories" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- ============================================================
-- products: slug/brand
-- ============================================================
ALTER TABLE "products" ADD COLUMN "slug" TEXT;
ALTER TABLE "products" ADD COLUMN "brand" TEXT;

UPDATE "products" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- ============================================================
-- product_variants: price -> basePrice (RENAME, өгөгдөл/CHECK
-- constraint хэвээр хадгалагдана — DROP+ADD биш), + sku/unit/costPrice/
-- barcode/isActive/defaultPreOrderEnabled/defaultPreOrderLeadDays.
-- ============================================================
ALTER TABLE "product_variants" RENAME COLUMN "price" TO "basePrice";
ALTER TABLE "product_variants" RENAME CONSTRAINT "product_variants_price_nonneg" TO "product_variants_baseprice_nonneg";

ALTER TABLE "product_variants" ADD COLUMN "sku" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'ширхэг';
ALTER TABLE "product_variants" ADD COLUMN "costPrice" DECIMAL(12,2);
ALTER TABLE "product_variants" ADD COLUMN "barcode" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "product_variants" ADD COLUMN "defaultPreOrderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product_variants" ADD COLUMN "defaultPreOrderLeadDays" INTEGER;

UPDATE "product_variants" SET "sku" = "id" WHERE "sku" IS NULL;
ALTER TABLE "product_variants" ALTER COLUMN "sku" SET NOT NULL;
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_cost_price_nonneg" CHECK ("costPrice" IS NULL OR "costPrice" >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_default_pre_order_lead_days_nonneg" CHECK ("defaultPreOrderLeadDays" IS NULL OR "defaultPreOrderLeadDays" >= 0);

-- ============================================================
-- inventory_items: lowStockThreshold-ийн анхны утга 0 → 5 (зөвхөн шинэ
-- мөрөнд нөлөөлнэ, одоо байгаа мөрийн утгыг өөрчлөхгүй), + branchPrice/
-- preOrderEnabledOverride/preOrderLeadDaysOverride (§6 override-ийн загвар,
-- inventory-effective.util.ts).
-- ============================================================
ALTER TABLE "inventory_items" ALTER COLUMN "lowStockThreshold" SET DEFAULT 5;

ALTER TABLE "inventory_items" ADD COLUMN "branchPrice" DECIMAL(12,2);
ALTER TABLE "inventory_items" ADD COLUMN "preOrderEnabledOverride" BOOLEAN;
ALTER TABLE "inventory_items" ADD COLUMN "preOrderLeadDaysOverride" INTEGER;

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branch_price_nonneg" CHECK ("branchPrice" IS NULL OR "branchPrice" >= 0);
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_pre_order_lead_days_override_nonneg" CHECK ("preOrderLeadDaysOverride" IS NULL OR "preOrderLeadDaysOverride" >= 0);
