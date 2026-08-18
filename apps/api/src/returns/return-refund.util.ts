import { Prisma, type ReturnStatus } from '@prisma/client';

// "Идэвхтэй" гэдэг нь өөр шинэ буцаалтын хүсэлт зөвшөөрөгдөхөөс өмнө
// давхардуулахгүй байх ёстой төлөвүүд (docs-ийн 2. Business logic шалгалт).
// ReturnRequestService.approve() бодит ажиллагаандаа REQUESTED-ээс шууд
// REFUNDED/REFUND_FAILED рүү (нэг PATCH /approve дотор) шилждэг тул
// APPROVED төлөвт удаан хугацаагаар зогсдоггүй ч, ирээдүйн (async refund)
// зам үүнийг ашиглаж болзошгүй тул хамгаалалтад оруулав.
export const ACTIVE_RETURN_STATUSES: ReturnStatus[] = ['REQUESTED', 'APPROVED'];

const RETURN_WINDOW_DAYS = 7;

// Хүргэгдсэн (COMPLETED) захиалгыг completedAt-аас хойш 7 хоногийн дотор
// л буцаах боломжтой (§7 модуль #9 даалгаврын шууд заавар). DB constraint
// БИШ (цаг хугацаа харьцуулах динамик логик) — service давхаргад.
export function isWithinReturnWindow(completedAt: Date, now: Date): boolean {
  const elapsedMs = now.getTime() - completedAt.getTime();
  return elapsedMs <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// refundAmount = unitPriceSnapshot × quantity × (1 - fee%/100) — зөвшөөрөх
// мөчийн SystemSetting(RETURN_FEE_PERCENT) утгын snapshot-оор тооцно
// (даалгаврын шууд заавар, §7 модуль #9 3(б)).
export function computeRefundAmount(
  unitPriceSnapshot: Prisma.Decimal,
  quantity: number,
  feePercent: Prisma.Decimal,
): Prisma.Decimal {
  const grossAmount = unitPriceSnapshot.mul(quantity);
  const feeMultiplier = new Prisma.Decimal(1).sub(feePercent.div(100));
  return grossAmount.mul(feeMultiplier);
}
