-- docs/plan.md §8 Phase 3b, Хэсэг B: төлбөрийн provider абстракц (mock/QPay).
-- `qpayPaymentId`-г provider-нейтраль болгож `providerInvoiceId`-руу
-- сольсон (20260816031301_add_branch_geo_and_catalog_fields-ийн
-- price→basePrice-той адил RENAME COLUMN, өгөгдөл алдагдахгүй) + webhook
-- (docs/adr/006) баталгаажуулсны дараа л тавигдах `paidAt` нэмэв.
ALTER TABLE "orders" RENAME COLUMN "qpayPaymentId" TO "providerInvoiceId";

ALTER TABLE "orders" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Одоо байгаа бүх мөрөнд NULL (Phase 3a-д checkout хийсэн захиалгууд
-- payment provider холбогдоогүй байсан) тул unique constraint аюулгүй
-- нэмэгдэнэ (Postgres NULL-ийг unique index-д давхардал гэж тооцдоггүй).
CREATE UNIQUE INDEX "orders_providerInvoiceId_key" ON "orders"("providerInvoiceId");
