-- ============================================================
-- Phase 4 засвар: GET /orders/:id/route дуудлага бүрд OsrmRoutingProvider
-- (public demo server) рүү давхардуулж хандахгүйн тулд тооцоолсон
-- чиглэлийг Order мөр дээр л кэшилнэ. Одоо байгаа мөрүүдэд NULL
-- (nullable) тул backfill шаардлагагүй. RLS policy өөрчлөлт шаардлагагүй
-- (мөр-түвшний, багана нэмэхэд нөлөөлдөггүй).
-- ============================================================
ALTER TABLE "orders" ADD COLUMN "routeDistanceMeters" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "routeDurationSeconds" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "routeGeometry" JSONB;
