-- docs/plan.md §7 модуль #9, §8 Phase 3c: буцаалт/нөхөн төлбөрийн хүснэгтүүд.
-- RLS policy тусдаа migration-д (enable_returns_settings_rls) — өмнөх
-- add_orders/enable_orders_rls хос migration-тэй ижил хуваалт.

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED', 'REFUND_FAILED');

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "rejectedReason" TEXT,
    "refundFeePercent" DECIMAL(5,2),
    "refundAmount" DECIMAL(12,2),
    "providerRefundId" TEXT,
    "reviewedByUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_requests_orderItemId_idx" ON "return_requests"("orderItemId");

-- CreateIndex
CREATE INDEX "return_requests_requestedByUserId_idx" ON "return_requests"("requestedByUserId");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Анхны утга (10%) — SystemSettingService.getReturnFeePercent() null-ийг
-- тусад нь шалгах шаардлагагүй болгохын тулд мөр үргэлж оршин байхаар
-- урьдчилж seed хийв (updatedByUserId=NULL — систем анхны утга).
INSERT INTO "system_settings" ("key", "value", "updatedByUserId", "updatedAt")
VALUES ('RETURN_FEE_PERCENT', '10', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
