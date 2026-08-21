import { Prisma } from '@prisma/client';
import type { CouponDiscountType } from '@prisma/client';

export interface CouponDiscountInput {
  discountType: CouponDiscountType;
  discountValue: Prisma.Decimal | string | number;
  maxDiscountAmount?: Prisma.Decimal | string | number | null;
}

// return-refund.util.ts-ийн "цэвэр функц, тусад нь 100% нэгж тестлэгдэнэ"
// зарчимтай адил — ReturnRequestService/CouponService хоёулаа энэ
// логикийг ДАХИН БИЧИХГҮЙ, ганц газар л тооцоолно (CLAUDE.md "логик
// давхардуулахгүй" зарчим).
export function computeCouponDiscountAmount(
  coupon: CouponDiscountInput,
  orderAmount: Prisma.Decimal,
): Prisma.Decimal {
  const discountValue = new Prisma.Decimal(coupon.discountValue);
  let discount =
    coupon.discountType === 'PERCENTAGE'
      ? orderAmount.mul(discountValue).div(100)
      : discountValue;

  if (coupon.maxDiscountAmount != null) {
    const cap = new Prisma.Decimal(coupon.maxDiscountAmount);
    if (discount.gt(cap)) {
      discount = cap;
    }
  }
  // Хямдрал захиалгын дүнгээс хэзээ ч хэтрэхгүй (totalAmount сөрөг
  // болохоос сэргийлнэ) — жиш: FIXED_AMOUNT 10,000₮ хямдралтай купон
  // 5,000₮-ийн захиалга дээр хэрэглэвэл 5,000₮-өөр хязгаарлагдана.
  if (discount.gt(orderAmount)) {
    discount = orderAmount;
  }
  if (discount.lt(0)) {
    discount = new Prisma.Decimal(0);
  }
  return discount;
}
