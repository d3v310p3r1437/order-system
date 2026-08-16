import {
  isOrderTransitionAllowed,
  isRestockingTransition,
} from './order-state-machine.js';

describe('isOrderTransitionAllowed', () => {
  it.each([
    ['CREATED', 'CONFIRMED'],
    ['CREATED', 'CANCELLED'],
    ['CONFIRMED', 'PREPARING'],
    ['CONFIRMED', 'CANCELLED'],
    ['PREPARING', 'READY'],
    ['READY', 'COMPLETED'],
  ] as const)('%s → %s зөвшөөрөгдсөн', (from, to) => {
    expect(isOrderTransitionAllowed(from, to)).toBe(true);
  });

  it.each([
    ['CREATED', 'PREPARING'],
    ['CREATED', 'READY'],
    ['CREATED', 'COMPLETED'],
    ['CONFIRMED', 'READY'],
    ['CONFIRMED', 'COMPLETED'],
    ['PREPARING', 'CANCELLED'],
    ['PREPARING', 'COMPLETED'],
    ['READY', 'CANCELLED'],
    ['COMPLETED', 'CANCELLED'],
    ['CANCELLED', 'CREATED'],
    ['COMPLETED', 'CREATED'],
  ] as const)('%s → %s зөвшөөрөгдөөгүй', (from, to) => {
    expect(isOrderTransitionAllowed(from, to)).toBe(false);
  });
});

describe('isRestockingTransition', () => {
  it('CANCELLED бол true (нөөц буцаана)', () => {
    expect(isRestockingTransition('CANCELLED')).toBe(true);
  });

  it.each(['CREATED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'] as const)(
    '%s бол false',
    (status) => {
      expect(isRestockingTransition(status)).toBe(false);
    },
  );
});
