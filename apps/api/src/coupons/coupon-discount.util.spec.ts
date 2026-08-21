import { Prisma } from '@prisma/client';
import { computeCouponDiscountAmount } from './coupon-discount.util.js';

describe('computeCouponDiscountAmount', () => {
  it('PERCENTAGE: захиалгын дүнгийн хувиар хямдруулна', () => {
    const result = computeCouponDiscountAmount(
      { discountType: 'PERCENTAGE', discountValue: 20 },
      new Prisma.Decimal(10000),
    );
    expect(result.toString()).toBe('2000');
  });

  it('FIXED_AMOUNT: тогтмол дүнгээр хямдруулна', () => {
    const result = computeCouponDiscountAmount(
      { discountType: 'FIXED_AMOUNT', discountValue: 1500 },
      new Prisma.Decimal(10000),
    );
    expect(result.toString()).toBe('1500');
  });

  it('PERCENTAGE: maxDiscountAmount-аар дээд хязгаарлагдана', () => {
    const result = computeCouponDiscountAmount(
      {
        discountType: 'PERCENTAGE',
        discountValue: 50,
        maxDiscountAmount: 3000,
      },
      new Prisma.Decimal(10000),
    );
    expect(result.toString()).toBe('3000');
  });

  it('FIXED_AMOUNT: захиалгын дүнгээс хэтрэхгүй (0-ээс доош болохгүй)', () => {
    const result = computeCouponDiscountAmount(
      { discountType: 'FIXED_AMOUNT', discountValue: 10000 },
      new Prisma.Decimal(5000),
    );
    expect(result.toString()).toBe('5000');
  });

  it('маш бага захиалгын дүн дээр ч сөрөг хямдрал буцаахгүй', () => {
    const result = computeCouponDiscountAmount(
      { discountType: 'FIXED_AMOUNT', discountValue: 1000 },
      new Prisma.Decimal(0),
    );
    expect(result.toString()).toBe('0');
  });
});
