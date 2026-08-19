-- ============================================================
-- Phase 4 §8 Хэсэг A: хүргэлтийн арга (PICKUP/DELIVERY) + (DELIVERY-д л
-- заавал) хаяг/координат. Одоо байгаа мөрүүд бүгд PICKUP анхны утгатай
-- (default), delivery талбарууд NULL хэвээр — backfill шаардлагагүй.
-- RLS policy өөрчлөлт шаардлагагүй (мөр-түвшний, багана нэмэхэд
-- нөлөөлдөггүй).
-- ============================================================
CREATE TYPE "OrderDeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

ALTER TABLE "orders" ADD COLUMN "deliveryMethod" "OrderDeliveryMethod" NOT NULL DEFAULT 'PICKUP';
ALTER TABLE "orders" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryLatitude" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "deliveryLongitude" DOUBLE PRECISION;
