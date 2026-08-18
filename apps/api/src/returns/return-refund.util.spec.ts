import { Prisma } from '@prisma/client';
import {
  ACTIVE_RETURN_STATUSES,
  computeRefundAmount,
  isWithinReturnWindow,
} from './return-refund.util.js';

describe('isWithinReturnWindow', () => {
  const now = new Date('2026-08-17T00:00:00.000Z');

  it('яг 7 хоногийн доторх completedAt-д true буцаана', () => {
    const completedAt = new Date('2026-08-11T01:00:00.000Z'); // ~5.96 хоног
    expect(isWithinReturnWindow(completedAt, now)).toBe(true);
  });

  it('яг 7 хоногийн ирмэгт (edge) true буцаана', () => {
    const completedAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(isWithinReturnWindow(completedAt, now)).toBe(true);
  });

  it('7 хоногоос хэтэрсэн completedAt-д false буцаана', () => {
    const completedAt = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1000,
    );
    expect(isWithinReturnWindow(completedAt, now)).toBe(false);
  });
});

describe('computeRefundAmount', () => {
  it('шимтгэлгүй (0%) үед бүтэн дүн буцаана', () => {
    const result = computeRefundAmount(
      new Prisma.Decimal(10000),
      2,
      new Prisma.Decimal(0),
    );
    expect(result.toNumber()).toBe(20000);
  });

  it('10% шимтгэлтэй үед шимтгэл хассан дүн буцаана', () => {
    const result = computeRefundAmount(
      new Prisma.Decimal(10000),
      2,
      new Prisma.Decimal(10),
    );
    expect(result.toNumber()).toBe(18000);
  });

  it('quantity=1, шимтгэлтэй бутархай дүнтэй ч зөв тооцно', () => {
    const result = computeRefundAmount(
      new Prisma.Decimal(39000),
      1,
      new Prisma.Decimal(12.5),
    );
    expect(result.toNumber()).toBeCloseTo(34125, 5);
  });
});

describe('ACTIVE_RETURN_STATUSES', () => {
  it('REQUESTED болон APPROVED-г агуулна, REJECTED/REFUNDED/REFUND_FAILED-г агуулахгүй', () => {
    expect(ACTIVE_RETURN_STATUSES).toEqual(
      expect.arrayContaining(['REQUESTED', 'APPROVED']),
    );
    expect(ACTIVE_RETURN_STATUSES).not.toEqual(
      expect.arrayContaining(['REJECTED', 'REFUNDED', 'REFUND_FAILED']),
    );
  });
});
