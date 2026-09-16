-- Бүтэцтэй шинж чанар (§7 модуль #3-ийн UX сайжруулалт, 2026-09-05):
-- ProductVariant-д color/size (Meilisearch facet+шүүлтэд ашиглагдах
-- хамгийн элбэг 2 шинж чанар тул тусдаа багана) болон attributes
-- (бусад чөлөөт key-value хос, зөвхөн дэлгэрэнгүй дэлгэцэд харуулах
-- зорилготой, Meilisearch-д индексжихгүй) нэмнэ. RLS policy өөрчлөлт
-- ШААРДАГГҮЙ — Category/Product-ийн `add_branch_geo_and_catalog_fields`
-- migration-тай адил зарчмаар зөвхөн одоо байгаа мөр-түвшний policy-д
-- багана нэмэх нь нөлөөлдөггүй (докс: docs/adr/005 "READ" зарчмын
-- тайлбарласан урьдал нөхцөл).

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "size" TEXT;
