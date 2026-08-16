import {
  computeAvailabilityStatus,
  resolveEffectivePreOrder,
  resolveEffectivePrice,
} from './inventory-effective.util.js';

describe('resolveEffectivePrice', () => {
  it('branchPrice override байхгүй бол variant.basePrice-ийг буцаана', () => {
    expect(
      resolveEffectivePrice(
        { branchPrice: null },
        { basePrice: 45000 as unknown as never },
      ),
    ).toBe(45000);
  });

  it('branchPrice override байвал variant.basePrice-ийг дарж бичнэ', () => {
    expect(
      resolveEffectivePrice(
        { branchPrice: 39000 as unknown as never },
        { basePrice: 45000 as unknown as never },
      ),
    ).toBe(39000);
  });
});

describe('resolveEffectivePreOrder', () => {
  it('override байхгүй бол variant-ийн анхны утгыг буцаана', () => {
    expect(
      resolveEffectivePreOrder(
        { preOrderEnabledOverride: null, preOrderLeadDaysOverride: null },
        { defaultPreOrderEnabled: true, defaultPreOrderLeadDays: 3 },
      ),
    ).toEqual({ enabled: true, leadDays: 3 });
  });

  it('override байвал variant-ийн анхны утгыг дарж бичнэ', () => {
    expect(
      resolveEffectivePreOrder(
        { preOrderEnabledOverride: false, preOrderLeadDaysOverride: 7 },
        { defaultPreOrderEnabled: true, defaultPreOrderLeadDays: 3 },
      ),
    ).toEqual({ enabled: false, leadDays: 7 });
  });
});

describe('computeAvailabilityStatus', () => {
  const variant = { defaultPreOrderEnabled: true, defaultPreOrderLeadDays: 5 };

  it('quantity > 0 бол IN_STOCK', () => {
    expect(
      computeAvailabilityStatus(
        {
          quantity: 3,
          preOrderEnabledOverride: null,
          preOrderLeadDaysOverride: null,
        },
        variant,
      ),
    ).toEqual({ status: 'IN_STOCK', leadDays: null });
  });

  it('quantity = 0 ба preorder идэвхтэй бол PRE_ORDER (leadDays-тай)', () => {
    expect(
      computeAvailabilityStatus(
        {
          quantity: 0,
          preOrderEnabledOverride: null,
          preOrderLeadDaysOverride: null,
        },
        variant,
      ),
    ).toEqual({ status: 'PRE_ORDER', leadDays: 5 });
  });

  it('quantity = 0 ба preorder идэвхгүй бол OUT_OF_STOCK', () => {
    expect(
      computeAvailabilityStatus(
        {
          quantity: 0,
          preOrderEnabledOverride: false,
          preOrderLeadDaysOverride: null,
        },
        variant,
      ),
    ).toEqual({ status: 'OUT_OF_STOCK', leadDays: null });
  });
});
